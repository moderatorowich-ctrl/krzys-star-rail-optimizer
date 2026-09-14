from __future__ import annotations

import json
import sys
import time
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPOSITORY_ROOT / "apps" / "scanner"))

from krzys_hsr_scanner.live_bridge import LiveBridge


def main() -> None:
    port = int(sys.argv[1])
    pairing_code = sys.argv[2]
    account = json.load(sys.stdin)
    bridge = LiveBridge(port=port)
    bridge.pairing_code = pairing_code
    bridge.start()
    deadline = time.time() + 5
    while not bridge.running:
        if time.time() >= deadline:
            raise RuntimeError("Live bridge did not start")
        time.sleep(0.02)
    bridge.publish(
        account,
        scanned_kinds=("character", "lightCone", "relic", "warp"),
    )
    print("READY", flush=True)
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        bridge.stop()


if __name__ == "__main__":
    main()
