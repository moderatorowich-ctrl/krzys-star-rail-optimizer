from __future__ import annotations

import json
import os
import threading
import time
from collections.abc import Callable
from pathlib import Path

from PIL import Image

from .model import ScanSession, serialize_session
from .ocr import OCREngine, crop_detail, parse_visible_text, preprocess, select_profile
from .safety import game_window


class GuidedCapture:
    """Captures only pixels visible on screen; optional navigation is explicit and off by default."""

    def __init__(
        self,
        engine: OCREngine,
        session: ScanSession,
        state_path: Path,
        debug_directory: Path,
    ) -> None:
        self.engine = engine
        self.session = session
        self.state_path = state_path
        self.debug_directory = debug_directory
        self.stop_event = threading.Event()
        self.pause_event = threading.Event()

    def capture_screen(self) -> Image.Image:
        from PIL import ImageGrab

        self.target_window, bounds = game_window()
        image = ImageGrab.grab(bbox=bounds, all_screens=True)
        image.load()
        return image

    def capture_once(self, save_debug: bool = False) -> tuple[bool, str]:
        image = self.capture_screen()
        profile = select_profile(*image.size)
        detail = crop_detail(image, profile)
        prepared = preprocess(detail)
        if save_debug:
            self.debug_directory.mkdir(parents=True, exist_ok=True)
            prepared.save(self.debug_directory / f"capture-{time.time_ns()}.png")
        text, confidence = self.engine.recognize(prepared)
        if self.stop_event.is_set() or self.pause_event.is_set():
            return False, "Capture discarded after stop/pause."
        item = parse_visible_text(text, confidence)
        added = self.session.add(item)
        self.session.current_index += 1
        self.save_state()
        return added, f"{item.kind}: {item.name} ({confidence:.0%})"

    def run(
        self,
        count: int,
        delay_seconds: float,
        navigation_delay_seconds: float,
        automatic_navigation: bool,
        save_debug: bool,
        progress: Callable[[str], None],
    ) -> None:
        self.session.cancelled = False
        self.session.expected_items = self.session.current_index + count
        try:
            progress("Switch to the HSR detail screen. Capture begins in 3 seconds. F8 stops globally.")
            if self.stop_event.wait(3):
                return
            while self.session.current_index < self.session.expected_items and not self.stop_event.is_set():
                while self.pause_event.is_set() and not self.stop_event.wait(0.05):
                    pass
                if self.stop_event.is_set():
                    break
                added, message = self.capture_once(save_debug)
                progress(("Captured " if added else "Possible duplicate: ") + message)
                if self.stop_event.is_set() or self.pause_event.is_set():
                    continue
                if automatic_navigation and self.session.current_index < self.session.expected_items:
                    import pyautogui
                    hwnd, _ = game_window()
                    if hwnd != self.target_window:
                        raise RuntimeError("Foreground game window changed; navigation stopped.")
                    if not self.stop_event.is_set() and not self.pause_event.is_set():
                        pyautogui.press("right")
                    if self.stop_event.wait(navigation_delay_seconds):
                        break
                elif self.session.current_index < self.session.expected_items:
                    self.pause()
                    progress("Paused for manual selection. Select the next item in HSR, then resume.")
                if self.stop_event.wait(delay_seconds):
                    break
        except Exception as error:
            self.cancel()
            progress(f"Stopped safely: {error}")
        finally:
            self.session.cancelled = self.stop_event.is_set()
            self.save_state()
            if not self.session.cancelled:
                progress("Capture complete. Review all fields before export.")

    def pause(self) -> None:
        self.pause_event.set()
        self.session.paused = True

    def resume(self) -> None:
        self.pause_event.clear()
        self.session.paused = False

    def cancel(self) -> None:
        self.stop_event.set()

    def save_state(self) -> None:
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        staging = self.state_path.with_suffix(".pending.json")
        staging.write_text(json.dumps(serialize_session(self.session), indent=2), encoding="utf-8")
        os.replace(staging, self.state_path)
