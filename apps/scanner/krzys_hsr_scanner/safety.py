"""Windows hotkey and visible-window checks. No process or game-data access."""
from __future__ import annotations

import ctypes
import os
import threading
from ctypes import wintypes
from collections.abc import Callable


def game_window() -> tuple[int, tuple[int, int, int, int]]:
    if os.name != "nt":
        raise RuntimeError("Live capture is supported only on Windows.")
    user32 = ctypes.WinDLL("user32", use_last_error=True)
    user32.GetForegroundWindow.restype = wintypes.HWND
    user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
    hwnd = user32.GetForegroundWindow()
    title = ctypes.create_unicode_buffer(512)
    user32.GetWindowTextW(hwnd, title, len(title))
    if "honkai: star rail" not in title.value.casefold():
        raise RuntimeError("HSR must be the foreground window. Refocus the English game client, then resume.")
    rect = wintypes.RECT()
    user32.GetClientRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
    user32.ClientToScreen.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.POINT)]
    if not user32.GetClientRect(hwnd, ctypes.byref(rect)):
        raise RuntimeError("Cannot read the visible game window bounds.")
    origin = wintypes.POINT(0, 0)
    if not user32.ClientToScreen(hwnd, ctypes.byref(origin)):
        raise RuntimeError("Cannot locate the visible game window.")
    return int(hwnd), (origin.x, origin.y, origin.x + rect.right, origin.y + rect.bottom)


class GlobalStopHotkey:
    def __init__(self, stop: Callable[[], None]) -> None:
        self.stop = stop
        self.ready = threading.Event()
        self.closed = threading.Event()
        self.error: str | None = None
        self.thread = threading.Thread(target=self._listen, daemon=True)
        self.thread.start()
        self.ready.wait(2)
        if not self.ready.is_set() or self.error:
            raise RuntimeError(self.error or "Global F8 hotkey registration timed out.")

    def _listen(self) -> None:
        if os.name != "nt":
            self.error = "Global stop is available only on Windows."
            self.ready.set()
            return
        user32 = ctypes.WinDLL("user32", use_last_error=True)
        if not user32.RegisterHotKey(None, 1, 0x4000, 0x77):
            self.error = "F8 is already registered by another application. Capture is disabled."
            self.ready.set()
            return
        self.ready.set()
        message = wintypes.MSG()
        try:
            while not self.closed.wait(0.01):
                while user32.PeekMessageW(ctypes.byref(message), None, 0x0312, 0x0312, 1):
                    self.stop()
        finally:
            user32.UnregisterHotKey(None, 1)

    def close(self) -> None:
        self.closed.set()
