# Scanner third-party notices

The Windows scanner is built with Python 3.12 and the dependency versions resolved from `requirements.txt`. The release build copies every available package license, notice, and authors file into `third-party-licenses/` alongside the executable.

| Component                 | License                                    | Project                                          |
| ------------------------- | ------------------------------------------ | ------------------------------------------------ |
| Python                    | PSF-2.0                                    | python.org                                       |
| altgraph                  | MIT                                        | altgraph.readthedocs.io                          |
| MouseInfo                 | GPL-3.0-or-later                           | github.com/asweigart/mouseinfo                   |
| MSS                       | MIT                                        | github.com/BoboTiG/python-mss                    |
| packaging                 | Apache-2.0 OR BSD-2-Clause                 | packaging.pypa.io                                |
| pefile                    | MIT                                        | github.com/erocarrera/pefile                     |
| Pillow                    | MIT-CMU                                    | python-pillow.org                                |
| PyAutoGUI                 | BSD License                                | github.com/asweigart/pyautogui                   |
| PyGetWindow               | BSD License                                | github.com/asweigart/pygetwindow                 |
| PyInstaller               | GPL-2.0-or-later with bootloader exception | pyinstaller.org                                  |
| pyinstaller-hooks-contrib | Multiple licenses; see bundled license     | github.com/pyinstaller/pyinstaller-hooks-contrib |
| PyMsgBox                  | BSD-3-Clause                               | github.com/asweigart/pymsgbox                    |
| pyperclip                 | BSD-3-Clause                               | github.com/asweigart/pyperclip                   |
| PyRect                    | BSD-3-Clause                               | github.com/asweigart/pyrect                      |
| PyScreeze                 | MIT                                        | github.com/asweigart/pyscreeze                   |
| pytesseract               | Apache-2.0                                 | github.com/madmaze/pytesseract                   |
| pytweening                | MIT                                        | github.com/asweigart/pytweening                  |
| pywin32-ctypes            | BSD-3-Clause                               | github.com/enthought/pywin32-ctypes              |

Tesseract OCR is a separately installed system prerequisite and is not bundled in the scanner ZIP. Its Apache-2.0 license and notices are provided by the selected Tesseract distribution.
