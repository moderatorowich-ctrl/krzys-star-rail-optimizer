# Krzys HSR Scanner

**Scanner v1.0.0 · Supports Honkai: Star Rail v4.5 · Export schemas 1–2**

Krzys HSR Scanner is a Windows desktop companion that turns visible inventory screens into a locally validated JSON export.

## Safety model

The scanner captures pixels through the Windows desktop capture API and sends cropped regions to a locally installed Tesseract OCR engine. It does not inject DLLs, attach to the game process, read or write process memory, intercept traffic, read credentials or browser state, modify game files, evade anti-cheat, automate combat, or upload account data.

Normal guided capture does not require administrator privileges. If Windows blocks capture, switch the game to borderless or windowed mode. Elevating the scanner is not recommended and is not required by its design.

Optional keyboard navigation is visible in the interface and disabled by default. F8 is the emergency-stop hotkey. Pause, cancel, or F8 immediately stops further input. The user remains responsible for checking the game's current terms and local policies.

## Installation

1. Install the current [Tesseract OCR for Windows](https://tesseract-ocr.github.io/tessdoc/Installation.html). The scanner detects the conventional `C:\Program Files\Tesseract-OCR\tesseract.exe` path; otherwise set `TESSERACT_CMD` to the executable path.
2. Download `Krzys-HSR-Scanner-v1.0.0-for-HSR-v4.5.zip` from Releases and extract it.
3. Verify the published SHA-256 checksum asset.
4. Start `Krzys-HSR-Scanner.exe`. A SmartScreen warning can appear because the community executable is not Authenticode-signed.
5. Open the game in English at a 16:9 resolution. 1920×1080 is the primary tested profile; coordinate scaling handles other common 16:9 resolutions and Windows DPI scaling.
6. Choose guided capture and review/correct every captured item. Export is blocked until all items are marked reviewed and the strict schema passes.

Fullscreen capture availability varies by GPU/overlay configuration. Borderless is the most reliable fallback.

## Scan lifecycle

The interface shows count, progress, and estimated remaining time. Captured fields carry OCR confidence. The review editor exposes the name and full recognized field object; export is blocked until every item is reviewed. Repeated visual text is retained and flagged as a possible duplicate because identical-looking relics can be legitimate. Cancelled sessions are saved atomically and can be resumed.

UID capture is off by default. Debug screenshots are never created unless explicitly enabled; deletion requires confirmation. Diagnostic bundles never include screenshots, raw inventory fields, credentials, cookies, tokens, or UID.

Exports follow the schema documented in `packages/shared/src/index.ts`, contain supported game/scanner/schema versions, and use `Krzys-HSR-Scanner-v1.0.0-for-HSR-v4.5-<timestamp>.json`. Import through the website's **Data & import** view.

## Source build

Install Python 3.12+, Tesseract OCR, and the pinned project requirements:

```powershell
python -m pip install -r apps/scanner/requirements.txt
python -m unittest discover -s apps/scanner/tests -t apps/scanner -v
python apps/scanner/scripts/build.py
```

PyInstaller writes the executable and release ZIP under `apps/scanner/dist`. Release automation also publishes a SHA-256 file and corresponding-source archive. The scanner is licensed GPL-3.0-only.
