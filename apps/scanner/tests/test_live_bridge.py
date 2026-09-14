import json
import socket
import time
import unittest

from websockets.exceptions import ConnectionClosedError
from websockets.sync.client import connect

from krzys_hsr_scanner.live_bridge import LiveBridge, new_pairing_code


def available_port() -> int:
    with socket.socket() as candidate:
        candidate.bind(("127.0.0.1", 0))
        return int(candidate.getsockname()[1])


class LiveBridgeTests(unittest.TestCase):
    def test_pairing_code_avoids_ambiguous_characters(self) -> None:
        code = new_pairing_code()
        self.assertRegex(code, r"^[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){2}$")

    def test_rejects_bad_pairing_and_publishes_after_valid_pairing(self) -> None:
        bridge = LiveBridge(port=available_port())
        bridge.start()
        uri = f"ws://127.0.0.1:{bridge.port}/ws"
        deadline = time.time() + 3
        while True:
            try:
                websocket = connect(uri, origin="http://localhost:5173", open_timeout=0.5)
                break
            except OSError:
                if time.time() >= deadline:
                    bridge.stop()
                    self.fail("Live bridge did not start")
                time.sleep(0.05)
        try:
            websocket.send(json.dumps({"type": "pair", "protocolVersion": 1, "pairingCode": "WRONG"}))
            with self.assertRaises(ConnectionClosedError) as rejected:
                websocket.recv()
            self.assertEqual(rejected.exception.rcvd.code, 4001)
        finally:
            websocket.close()

        with connect(uri, origin="http://localhost:5173") as paired:
            paired.send(
                json.dumps(
                    {
                        "type": "pair",
                        "protocolVersion": 1,
                        "pairingCode": bridge.pairing_code,
                    }
                )
            )
            initial = json.loads(paired.recv())
            self.assertFalse(initial["ready"])
            self.assertEqual(initial["scannedKinds"], [])
            bridge.publish(
                {"metadata": {"schemaVersion": 2}},
                pending_review=0,
                scanned_kinds=("character", "relic"),
            )
            update = json.loads(paired.recv())
            self.assertTrue(update["ready"])
            self.assertEqual(update["revision"], 1)
            self.assertEqual(update["scannedKinds"], ["character", "relic"])
        bridge.stop()


if __name__ == "__main__":
    unittest.main()
