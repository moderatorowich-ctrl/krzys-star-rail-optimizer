from __future__ import annotations

import shutil
import subprocess
import sys
import zipfile
import os
from importlib import metadata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = ROOT.parents[1]
sys.path.insert(0, str(ROOT))
from krzys_hsr_scanner import SCANNER_VERSION as VERSION, SUPPORTED_GAME_VERSION as GAME_VERSION

DIST = ROOT / "dist"
NAME = f"Krzys-HSR-Scanner-v{VERSION}-for-HSR-v{GAME_VERSION}"
RUNTIME_DISTRIBUTIONS = (
    "altgraph",
    "MouseInfo",
    "mss",
    "packaging",
    "pefile",
    "Pillow",
    "PyAutoGUI",
    "PyGetWindow",
    "pyinstaller",
    "pyinstaller-hooks-contrib",
    "PyMsgBox",
    "pyperclip",
    "PyRect",
    "PyScreeze",
    "pytesseract",
    "pytweening",
    "pywin32-ctypes",
    "websockets",
)


def copy_distribution_licenses(destination: Path) -> None:
    destination.mkdir(parents=True)
    for distribution_name in RUNTIME_DISTRIBUTIONS:
        distribution = metadata.distribution(distribution_name)
        copied = False
        for entry in distribution.files or ():
            filename = entry.name.lower()
            if not filename.startswith(("license", "copying", "notice", "authors")):
                continue
            source = Path(distribution.locate_file(entry))
            if not source.is_file():
                continue
            target = destination / distribution_name / entry.name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
            copied = True
        if not copied:
            summary = destination / distribution_name / "METADATA-LICENSE.txt"
            summary.parent.mkdir(parents=True, exist_ok=True)
            license_name = distribution.metadata.get("License-Expression") or distribution.metadata.get("License") or "See project metadata"
            project_url = distribution.metadata.get("Home-page") or "See package metadata"
            summary.write_text(
                f"{distribution.metadata.get('Name', distribution_name)} {distribution.version}\n"
                f"License: {license_name}\nProject: {project_url}\n",
                encoding="utf-8",
            )


def main() -> None:
    DIST.mkdir(exist_ok=True)
    subprocess.run(
        [
            sys.executable,
            "-m",
            "PyInstaller",
            "--noconfirm",
            "--clean",
            "--onefile",
            "--windowed",
            "--exclude-module",
            "numpy",
            "--exclude-module",
            "pandas",
            "--name",
            "Krzys-HSR-Scanner",
            "--paths",
            str(ROOT),
            "--add-data",
            f"{REPOSITORY_ROOT / 'packages' / 'game-data' / 'src' / 'game-data.generated.json'}{os.pathsep}krzys_hsr_scanner/data",
            "--add-data",
            f"{REPOSITORY_ROOT / 'packages' / 'game-data' / 'src' / 'relic-rolls.generated.json'}{os.pathsep}krzys_hsr_scanner/data",
            str(ROOT / "main.py"),
        ],
        cwd=ROOT,
        check=True,
    )
    executable = DIST / "Krzys-HSR-Scanner.exe"
    if not executable.exists():
        raise FileNotFoundError(executable)
    package_dir = ROOT / "build" / NAME
    expected_build_root = (ROOT / "build").resolve()
    if package_dir.resolve().parent != expected_build_root or package_dir.name != NAME:
        raise ValueError(f"Unexpected package directory: {package_dir}")
    if package_dir.exists():
        shutil.rmtree(package_dir)
    package_dir.mkdir(parents=True)
    shutil.copy2(executable, package_dir / executable.name)
    shutil.copy2(ROOT / "LICENSE", package_dir / "LICENSE")
    shutil.copy2(ROOT / "COPYING", package_dir / "COPYING")
    shutil.copy2(ROOT / "THIRD_PARTY_NOTICES.md", package_dir / "THIRD_PARTY_NOTICES.md")
    shutil.copy2(REPOSITORY_ROOT / "docs" / "SCANNER.md", package_dir / "README.txt")
    copy_distribution_licenses(package_dir / "third-party-licenses")
    python_license = Path(sys.base_prefix) / "LICENSE.txt"
    if python_license.exists():
        target = package_dir / "third-party-licenses" / "Python" / "LICENSE.txt"
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(python_license, target)
    archive = DIST / f"{NAME}.zip"
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        for file in package_dir.rglob("*"):
            if file.is_file():
                bundle.write(file, file.relative_to(package_dir))
    digest = __import__("hashlib").sha256(archive.read_bytes()).hexdigest()
    checksum = archive.with_suffix(".zip.sha256")
    checksum.write_text(f"{digest}  {archive.name}\n", encoding="ascii")
    print(f"Built {archive} ({archive.stat().st_size:,} bytes)")
    print(f"SHA-256: {digest}")


if __name__ == "__main__":
    main()
