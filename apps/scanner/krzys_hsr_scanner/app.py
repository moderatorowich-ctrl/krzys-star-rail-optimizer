from __future__ import annotations

import json
import os
import platform
import shutil
import threading
import tkinter as tk
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from . import SCANNER_VERSION, SUPPORTED_GAME_VERSION
from .capture import GuidedCapture
from .model import ScanSession, deserialize_session, export_payload, serialize_session, validate_export
from .ocr import TesseractEngine
from .safety import GlobalStopHotkey


APP_NAME = "Krzys HSR Scanner"
APP_HOME = Path(os.getenv("LOCALAPPDATA", Path.home())) / "KrzysHSRScanner"
SESSION_PATH = APP_HOME / "scan-session.json"
DEBUG_DIR = APP_HOME / "debug-screenshots"


class ScannerApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        APP_HOME.mkdir(parents=True, exist_ok=True)
        self.title(f"{APP_NAME} v{SCANNER_VERSION} · HSR v{SUPPORTED_GAME_VERSION}")
        self.geometry("980x690")
        self.minsize(820, 600)
        self.configure(bg="#07111f")
        self.session = self._load_session()
        self.capture: GuidedCapture | None = None
        self.hotkey: GlobalStopHotkey | None = None
        self.worker: threading.Thread | None = None
        self.closing = False
        self.status = tk.StringVar(value="Ready for guided capture.")
        self.progress = tk.DoubleVar(value=self.session.progress * 100)
        self.count = tk.IntVar(value=max(1, self.session.expected_items or 1))
        self.capture_delay = tk.DoubleVar(value=0.7)
        self.navigation_delay = tk.DoubleVar(value=1.2)
        self.automatic_navigation = tk.BooleanVar(value=False)
        self.save_debug = tk.BooleanVar(value=False)
        self.include_uid = tk.BooleanVar(value=False)
        self.uid = tk.StringVar(value="")
        self._style()
        self._build()
        self.bind_all("<F8>", lambda _event: self.stop())
        self.protocol("WM_DELETE_WINDOW", self.on_close)
        self.after(100, self._refresh_items)

    def _style(self) -> None:
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure(".", background="#0d192a", foreground="#eaf4ff", fieldbackground="#111f33")
        style.configure("TNotebook", background="#07111f", borderwidth=0)
        style.configure("TNotebook.Tab", background="#0d192a", foreground="#8ea3b8", padding=(16, 10))
        style.map("TNotebook.Tab", background=[("selected", "#122b40")], foreground=[("selected", "#63e6ff")])
        style.configure("Accent.TButton", background="#63d8ee", foreground="#04111a", padding=(14, 9))
        style.configure("TButton", background="#15273c", foreground="#eaf4ff", padding=(12, 8))
        style.configure("Treeview", background="#0d192a", fieldbackground="#0d192a", foreground="#dcecff", rowheight=28)
        style.configure("Treeview.Heading", background="#12243a", foreground="#8ea3b8")

    def _build(self) -> None:
        header = tk.Frame(self, bg="#07111f", height=74)
        header.pack(fill="x", padx=22, pady=(16, 4))
        tk.Label(header, text="K", font=("Segoe UI", 28, "bold"), fg="#63e6ff", bg="#07111f").pack(side="left")
        title = tk.Frame(header, bg="#07111f")
        title.pack(side="left", padx=12)
        tk.Label(title, text=APP_NAME, font=("Segoe UI", 17, "bold"), fg="#eaf4ff", bg="#07111f").pack(anchor="w")
        tk.Label(title, text="Local screen capture + OCR · no process access", font=("Segoe UI", 9), fg="#8ea3b8", bg="#07111f").pack(anchor="w")
        tk.Label(header, text=f"SUPPORTS HSR v{SUPPORTED_GAME_VERSION}  •  SCANNER v{SCANNER_VERSION}", font=("Segoe UI", 9, "bold"), fg="#63e6ff", bg="#102238", padx=12, pady=7).pack(side="right")

        notebook = ttk.Notebook(self)
        notebook.pack(fill="both", expand=True, padx=22, pady=12)
        capture_tab = ttk.Frame(notebook, padding=20)
        review_tab = ttk.Frame(notebook, padding=20)
        settings_tab = ttk.Frame(notebook, padding=20)
        diagnostics_tab = ttk.Frame(notebook, padding=20)
        notebook.add(capture_tab, text="Capture")
        notebook.add(review_tab, text="Review & export")
        notebook.add(settings_tab, text="Settings")
        notebook.add(diagnostics_tab, text="Diagnostics")
        self._build_capture(capture_tab)
        self._build_review(review_tab)
        self._build_settings(settings_tab)
        self._build_diagnostics(diagnostics_tab)

        footer = tk.Frame(self, bg="#07111f")
        footer.pack(fill="x", padx=22, pady=(0, 15))
        tk.Label(footer, textvariable=self.status, fg="#8ea3b8", bg="#07111f", anchor="w").pack(side="left", fill="x", expand=True)
        tk.Label(footer, text="F8 = immediate stop", fg="#d8b96e", bg="#07111f").pack(side="right")

    def _build_capture(self, parent: ttk.Frame) -> None:
        ttk.Label(parent, text="Guided visible-inventory capture", font=("Segoe UI", 16, "bold")).pack(anchor="w")
        ttk.Label(parent, text="Open the relevant inventory detail screen in HSR. The scanner reads only pixels visible on your primary display.", foreground="#8ea3b8", wraplength=780).pack(anchor="w", pady=(4, 18))
        notice = tk.Frame(parent, bg="#102a38", padx=14, pady=12)
        notice.pack(fill="x", pady=(0, 18))
        tk.Label(notice, text="SAFETY MODEL", font=("Segoe UI", 8, "bold"), fg="#63e6ff", bg="#102a38").pack(anchor="w")
        tk.Label(notice, text="No DLL injection · no process memory · no network interception · no game files · no credentials · optional navigation off by default", fg="#bcd0df", bg="#102a38", wraplength=790).pack(anchor="w", pady=(3, 0))
        form = ttk.Frame(parent)
        form.pack(fill="x")
        ttk.Label(form, text="Items to capture").grid(row=0, column=0, sticky="w", pady=7)
        ttk.Spinbox(form, from_=1, to=999, textvariable=self.count, width=10).grid(row=0, column=1, sticky="w", padx=12)
        ttk.Label(form, text="Capture delay (seconds)").grid(row=1, column=0, sticky="w", pady=7)
        ttk.Spinbox(form, from_=0.2, to=10, increment=0.1, textvariable=self.capture_delay, width=10).grid(row=1, column=1, sticky="w", padx=12)
        ttk.Checkbutton(form, text="Enable optional keyboard navigation (presses Right only)", variable=self.automatic_navigation).grid(row=2, column=0, columnspan=2, sticky="w", pady=7)
        ttk.Checkbutton(form, text="Save debug screenshots (off by default)", variable=self.save_debug).grid(row=3, column=0, columnspan=2, sticky="w", pady=7)
        ttk.Progressbar(parent, variable=self.progress, maximum=100).pack(fill="x", pady=(25, 8))
        self.progress_label = ttk.Label(parent, text="0% · estimated time appears after start", foreground="#8ea3b8")
        self.progress_label.pack(anchor="w")
        buttons = ttk.Frame(parent)
        buttons.pack(fill="x", pady=22)
        ttk.Button(buttons, text="Capture current item", style="Accent.TButton", command=self.capture_once).pack(side="left")
        ttk.Button(buttons, text="Start guided scan", command=self.start).pack(side="left", padx=8)
        ttk.Button(buttons, text="Pause / resume", command=self.pause_resume).pack(side="left")
        ttk.Button(buttons, text="Stop now (F8)", command=self.stop).pack(side="right")

    def _build_review(self, parent: ttk.Frame) -> None:
        ttk.Label(parent, text="Review every recognized item", font=("Segoe UI", 16, "bold")).pack(anchor="w")
        ttk.Label(parent, text="Every item requires review. Double-click to correct its name and all recognized fields before export.", foreground="#8ea3b8").pack(anchor="w", pady=(4, 12))
        self.tree = ttk.Treeview(parent, columns=("kind", "name", "confidence", "status"), show="headings")
        for key, label, width in (("kind", "Type", 110), ("name", "Name", 360), ("confidence", "OCR", 90), ("status", "Review", 150)):
            self.tree.heading(key, text=label)
            self.tree.column(key, width=width)
        self.tree.pack(fill="both", expand=True)
        self.tree.bind("<Double-1>", self._edit_item)
        export = ttk.Frame(parent)
        export.pack(fill="x", pady=(14, 0))
        ttk.Checkbutton(export, text="Include UID in export (off by default)", variable=self.include_uid).pack(side="left")
        ttk.Entry(export, textvariable=self.uid, width=14).pack(side="left", padx=8)
        ttk.Button(export, text="Export validated JSON", style="Accent.TButton", command=self.export).pack(side="right")

    def _build_settings(self, parent: ttk.Frame) -> None:
        ttk.Label(parent, text="Capture settings", font=("Segoe UI", 16, "bold")).pack(anchor="w")
        ttk.Label(parent, text="Navigation delay (seconds)").pack(anchor="w", pady=(20, 5))
        ttk.Spinbox(parent, from_=0.3, to=15, increment=0.1, textvariable=self.navigation_delay, width=12).pack(anchor="w")
        ttk.Label(parent, text="Supported profiles: 1600×900, 1920×1080, 2560×1440 and 3840×2160. Windows DPI scaling is handled from captured pixel dimensions. HDR should be disabled for best OCR confidence.", foreground="#8ea3b8", wraplength=760).pack(anchor="w", pady=20)
        ttk.Label(parent, text="OCR engine", font=("Segoe UI", 11, "bold")).pack(anchor="w")
        ttk.Label(parent, text="Uses a local Tesseract installation. Set TESSERACT_CMD when it is not on PATH. English is the default OCR profile; additional language profiles can be installed locally.", foreground="#8ea3b8", wraplength=760).pack(anchor="w", pady=(5, 0))

    def _build_diagnostics(self, parent: ttk.Frame) -> None:
        ttk.Label(parent, text="Privacy-safe diagnostics", font=("Segoe UI", 16, "bold")).pack(anchor="w")
        ttk.Label(parent, text="Bundles contain versions, platform and item counts. They never include UID, raw items or screenshots. Saved debug images stay separate on this computer.", foreground="#8ea3b8", wraplength=780).pack(anchor="w", pady=(4, 20))
        ttk.Button(parent, text="Create diagnostic bundle", command=self.diagnostics).pack(anchor="w")
        ttk.Button(parent, text="Delete all debug screenshots", command=self.delete_debug).pack(anchor="w", pady=10)
        self.diag_text = tk.Text(parent, height=15, bg="#091524", fg="#c9ddec", insertbackground="#63e6ff", borderwidth=0, padx=12, pady=12)
        self.diag_text.pack(fill="both", expand=True, pady=(10, 0))
        self.diag_text.insert("1.0", self._diagnostic_text())
        self.diag_text.configure(state="disabled")

    def _load_session(self) -> ScanSession:
        try:
            return deserialize_session(json.loads(SESSION_PATH.read_text(encoding="utf-8")))
        except (FileNotFoundError, json.JSONDecodeError, TypeError, ValueError):
            return ScanSession()

    def _save_session(self) -> None:
        temporary = SESSION_PATH.with_suffix(".tmp")
        temporary.write_text(json.dumps(serialize_session(self.session), indent=2), encoding="utf-8")
        temporary.replace(SESSION_PATH)

    def _ensure_capture(self) -> GuidedCapture:
        if self.capture is None:
            executable = os.getenv("TESSERACT_CMD")
            self.capture = GuidedCapture(TesseractEngine(executable), self.session, SESSION_PATH, DEBUG_DIR)
        if self.hotkey is None:
            self.hotkey = GlobalStopHotkey(self.capture.cancel)
        return self.capture

    def capture_once(self) -> None:
        self.start(single=True)

    def start(self, single: bool = False) -> None:
        if self.worker and self.worker.is_alive():
            return
        try:
            capture = self._ensure_capture()
            count = 1 if single else self.count.get()
            delay = self.capture_delay.get()
            navigation_delay = self.navigation_delay.get()
            if not 1 <= count <= 999 or not 0.2 <= delay <= 10 or not 0.3 <= navigation_delay <= 15:
                raise ValueError("Invalid count or capture delays.")
        except Exception as error:
            messagebox.showerror(APP_NAME, f"OCR is not ready:\n\n{error}\n\nInstall Tesseract locally or set TESSERACT_CMD.")
            return
        capture.stop_event.clear()
        capture.resume()
        self.worker = threading.Thread(target=capture.run, args=(count, delay, navigation_delay, False if single else self.automatic_navigation.get(), self.save_debug.get(), self._thread_status), daemon=True)
        self.worker.start()
        self.status.set("Scanning. Press F8 at any time for an immediate safe stop.")

    def _thread_status(self, message: str) -> None:
        if not self.closing:
            self.after(0, lambda: (self.status.set(message), self._refresh_items()))

    def pause_resume(self) -> None:
        if not self.capture or not self.worker or not self.worker.is_alive():
            self.status.set("No capture is running.")
            return
        capture = self.capture
        if capture.pause_event.is_set():
            self.status.set("Switch to HSR. Resuming in 3 seconds.")
            self.after(3000, capture.resume)
        else:
            capture.pause()
            self.status.set("Paused. No capture or navigation will occur.")

    def stop(self) -> None:
        if self.capture:
            self.capture.cancel()
        self.status.set("Stop requested. Input automation is disabled immediately.")

    def _refresh_items(self) -> None:
        if not hasattr(self, "tree"):
            return
        for item_id in self.tree.get_children():
            self.tree.delete(item_id)
        for index, item in enumerate(self.session.items):
            self.tree.insert("", "end", iid=str(index), values=(item.kind.replace("_", " ").title(), item.name, f"{item.confidence:.0%}", "Reviewed" if item.fields.get("reviewed") else "Review required"))
        self.progress.set(self.session.progress * 100)
        remaining = max(0, self.session.expected_items - self.session.current_index)
        estimate = remaining * (self.capture_delay.get() + (self.navigation_delay.get() if self.automatic_navigation.get() else 0))
        self.progress_label.configure(text=f"{self.session.progress:.0%} · about {estimate:.0f}s remaining · {len(self.session.items)} captured items")

    def _edit_item(self, _event: tk.Event) -> None:
        if self.worker and self.worker.is_alive():
            messagebox.showwarning(APP_NAME, "Stop capture before editing results.")
            return
        selection = self.tree.selection()
        if not selection:
            return
        index = int(selection[0])
        item = self.session.items[index]
        dialog = tk.Toplevel(self)
        dialog.title("Correct OCR result")
        dialog.configure(bg="#0d192a")
        value = tk.StringVar(value=item.name)
        tk.Label(dialog, text="Corrected name", bg="#0d192a", fg="#eaf4ff").pack(anchor="w", padx=16, pady=(16, 5))
        entry = ttk.Entry(dialog, textvariable=value, width=48)
        entry.pack(padx=16)
        entry.focus_set()
        tk.Label(dialog, text="Recognized fields (JSON): correct all missing or inaccurate values", bg="#0d192a", fg="#eaf4ff").pack(anchor="w", padx=16, pady=8)
        fields_editor = tk.Text(dialog, width=75, height=22)
        fields_editor.pack(padx=16)
        fields_editor.insert("1.0", json.dumps(item.fields, indent=2))
        def save() -> None:
            try:
                fields = json.loads(fields_editor.get("1.0", "end"))
                if not isinstance(fields, dict):
                    raise ValueError("Fields must be a JSON object.")
            except (ValueError, TypeError) as error:
                messagebox.showerror(APP_NAME, str(error))
                return
            item.name = value.get().strip() or item.name
            item.fields = fields
            item.fields["reviewed"] = True
            self._save_session()
            self._refresh_items()
            dialog.destroy()
        ttk.Button(dialog, text="Save correction", style="Accent.TButton", command=save).pack(pady=16)

    def export(self) -> None:
        if self.worker and self.worker.is_alive():
            messagebox.showwarning(APP_NAME, "Stop capture before exporting a consistent snapshot.")
            return
        if not self.session.items or any(not item.fields.get("reviewed") for item in self.session.items):
            messagebox.showwarning(APP_NAME, "Review and save every captured item before exporting. No fields will be guessed.")
            return
        if self.include_uid.get() and (not self.uid.get().isdigit() or len(self.uid.get()) != 9):
            messagebox.showwarning(APP_NAME, "UID must contain exactly 9 digits, or turn off UID inclusion.")
            return
        payload = export_payload(self.session, self.include_uid.get(), self.uid.get())
        errors = validate_export(payload)
        if errors:
            messagebox.showerror(APP_NAME, "Export validation failed:\n\n" + "\n".join(errors))
            return
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%SZ")
        filename = f"Krzys-HSR-Scanner-v{SCANNER_VERSION}-for-HSR-v{SUPPORTED_GAME_VERSION}-{timestamp}.json"
        path = filedialog.asksaveasfilename(title="Export account scan", initialfile=filename, defaultextension=".json", filetypes=[("JSON account export", "*.json")])
        if path:
            Path(path).write_text(json.dumps(payload, indent=2), encoding="utf-8")
            self.status.set(f"Validated export saved: {Path(path).name}")
            messagebox.showinfo(APP_NAME, "Validated local export created. Drag this JSON file into Krzys Star Rail Optimizer.")

    def _diagnostic_text(self) -> str:
        return "\n".join((f"Application: {APP_NAME}", f"Scanner version: {SCANNER_VERSION}", f"Supported HSR version: {SUPPORTED_GAME_VERSION}", "Export schema: 2", f"Platform: {platform.platform()}", f"Python: {platform.python_version()}", f"Captured item counts: {len(self.session.items)}", f"Low-confidence items: {sum(item.confidence < 0.78 for item in self.session.items)}", "UID: redacted", "Credentials: never collected"))

    def diagnostics(self) -> None:
        filename = f"Krzys-HSR-Scanner-diagnostics-v{SCANNER_VERSION}-HSR-v{SUPPORTED_GAME_VERSION}.zip"
        path = filedialog.asksaveasfilename(title="Save diagnostic bundle", initialfile=filename, defaultextension=".zip", filetypes=[("ZIP archive", "*.zip")])
        if not path:
            return
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
            bundle.writestr("diagnostics.txt", self._diagnostic_text())
            bundle.writestr("manifest.json", json.dumps({"scannerVersion": SCANNER_VERSION, "gameVersion": SUPPORTED_GAME_VERSION, "createdAt": datetime.now(timezone.utc).isoformat(), "uidRedacted": True}, indent=2))
        self.status.set(f"Diagnostic bundle saved: {Path(path).name}")

    def delete_debug(self) -> None:
        if DEBUG_DIR.exists():
            target = DEBUG_DIR.resolve()
            if target.parent != APP_HOME.resolve() or target.name != 'debug-screenshots':
                raise ValueError('Unexpected debug directory.')
            if not messagebox.askyesno(APP_NAME, "Permanently delete locally saved debug screenshots? This cannot be undone."):
                return
            shutil.rmtree(target)
        self.status.set("All debug screenshots were permanently deleted.")

    def on_close(self) -> None:
        self.closing = True
        self.stop()
        if self.hotkey:
            self.hotkey.close()
        self.destroy()


def main() -> None:
    ScannerApp().mainloop()


if __name__ == "__main__":
    main()
