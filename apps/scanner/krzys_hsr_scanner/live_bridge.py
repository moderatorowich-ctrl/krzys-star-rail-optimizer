from __future__ import annotations

import hmac
import json
import re
import secrets
import threading
from datetime import datetime, timezone
from typing import Any, Callable

from websockets.exceptions import ConnectionClosed
from websockets.sync.server import Server, ServerConnection, serve

from . import SCANNER_VERSION, SUPPORTED_GAME_VERSION


LIVE_PROTOCOL_VERSION = 1
DEFAULT_LIVE_PORT = 23313
PRODUCTION_ORIGIN = "https://moderatorowich-ctrl.github.io"
LOCAL_ORIGIN = re.compile(r"^https?://(?:127\.0\.0\.1|localhost)(?::\d+)?$")
PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def new_pairing_code() -> str:
    raw = "".join(secrets.choice(PAIRING_ALPHABET) for _ in range(12))
    return "-".join(raw[index : index + 4] for index in range(0, len(raw), 4))


class LiveBridge:
    """Authenticated loopback-only WebSocket bridge for reviewed scanner snapshots."""

    def __init__(
        self,
        port: int = DEFAULT_LIVE_PORT,
        status_callback: Callable[[str], None] | None = None,
    ) -> None:
        self.port = port
        self.pairing_code = new_pairing_code()
        self.status_callback = status_callback or (lambda _message: None)
        self._server: Server | None = None
        self._thread: threading.Thread | None = None
        self._lock = threading.RLock()
        self._clients: set[ServerConnection] = set()
        self._revision = 0
        self._snapshot: dict[str, Any] = self._message(None, pending_review=0, scanned_kinds=())

    @property
    def running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    @property
    def connected_clients(self) -> int:
        with self._lock:
            return len(self._clients)

    @property
    def revision(self) -> int:
        with self._lock:
            return self._revision

    def rotate_pairing_code(self) -> str:
        self.pairing_code = new_pairing_code()
        with self._lock:
            clients = tuple(self._clients)
            self._clients.clear()
        for client in clients:
            try:
                client.close(code=4001, reason="Pairing code rotated")
            except ConnectionClosed:
                pass
        self.status_callback("Pairing code rotated; existing browser connections were closed.")
        return self.pairing_code

    def _message(
        self,
        account: dict[str, Any] | None,
        pending_review: int,
        scanned_kinds: tuple[str, ...],
    ) -> dict[str, Any]:
        return {
            "type": "snapshot",
            "protocolVersion": LIVE_PROTOCOL_VERSION,
            "scannerVersion": SCANNER_VERSION,
            "gameVersion": SUPPORTED_GAME_VERSION,
            "revision": self._revision,
            "capturedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "ready": account is not None,
            "pendingReview": pending_review,
            "scannedKinds": list(scanned_kinds),
            **({"account": account} if account is not None else {}),
        }

    def publish(
        self,
        account: dict[str, Any] | None,
        pending_review: int = 0,
        scanned_kinds: tuple[str, ...] = (),
    ) -> None:
        if pending_review < 0:
            raise ValueError("pending_review cannot be negative")
        with self._lock:
            self._revision += 1
            self._snapshot = self._message(account, pending_review, scanned_kinds)
            payload = json.dumps(self._snapshot, separators=(",", ":"))
            clients = tuple(self._clients)
        stale: list[ServerConnection] = []
        for client in clients:
            try:
                client.send(payload)
            except ConnectionClosed:
                stale.append(client)
        if stale:
            with self._lock:
                self._clients.difference_update(stale)
        state = "validated snapshot" if account is not None else f"{pending_review} pending review"
        self.status_callback(
            f"Live revision {self._revision} published ({state}) to {self.connected_clients} client(s)."
        )

    def snapshot_json(self) -> str:
        with self._lock:
            return json.dumps(self._snapshot, separators=(",", ":"))

    def _handler(self, websocket: ServerConnection) -> None:
        if websocket.request.path != "/ws":
            websocket.close(code=1008, reason="Unsupported path")
            return
        try:
            raw = websocket.recv(timeout=10)
            if not isinstance(raw, str) or len(raw) > 4096:
                raise ValueError("Invalid pairing message")
            message = json.loads(raw)
            supplied = str(message.get("pairingCode", ""))
            valid = (
                message.get("type") == "pair"
                and message.get("protocolVersion") == LIVE_PROTOCOL_VERSION
                and hmac.compare_digest(supplied, self.pairing_code)
            )
            if not valid:
                websocket.close(code=4001, reason="Pairing rejected")
                return
            with self._lock:
                self._clients.add(websocket)
            websocket.send(self.snapshot_json())
            self.status_callback(f"Browser paired locally ({self.connected_clients} connected).")
            for incoming in websocket:
                if not isinstance(incoming, str) or len(incoming) > 4096:
                    websocket.close(code=1009, reason="Message too large")
                    return
                request = json.loads(incoming)
                if request.get("type") == "requestSnapshot":
                    websocket.send(self.snapshot_json())
        except (ConnectionClosed, TimeoutError, ValueError, TypeError, json.JSONDecodeError):
            return
        finally:
            with self._lock:
                self._clients.discard(websocket)
            self.status_callback(f"Local browser disconnected ({self.connected_clients} connected).")

    def _serve(self) -> None:
        try:
            with serve(
                self._handler,
                "127.0.0.1",
                self.port,
                origins=[PRODUCTION_ORIGIN, LOCAL_ORIGIN],
                compression=None,
                open_timeout=5,
                close_timeout=2,
                max_size=4096,
                server_header=None,
            ) as server:
                self._server = server
                self.status_callback(
                    f"Live bridge ready at ws://127.0.0.1:{self.port}/ws (loopback only)."
                )
                server.serve_forever()
        except OSError as error:
            self.status_callback(f"Live bridge could not start: {error}")
        finally:
            self._server = None

    def start(self) -> None:
        if self.running:
            return
        self._thread = threading.Thread(target=self._serve, name="ksro-live-bridge", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        server = self._server
        if server is not None:
            server.shutdown()
        thread = self._thread
        if thread and thread.is_alive() and thread is not threading.current_thread():
            thread.join(timeout=3)
        self._thread = None
        self.status_callback("Live bridge stopped.")
