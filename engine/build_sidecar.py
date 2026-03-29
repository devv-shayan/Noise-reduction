from __future__ import annotations

import subprocess
import sys
from shutil import copy2
from pathlib import Path


def tauri_sidecar_name() -> str:
    if sys.platform == "win32":
        return "engine-x86_64-pc-windows-msvc.exe"
    if sys.platform == "darwin":
        machine = "aarch64" if "arm" in __import__("platform").machine().lower() else "x86_64"
        return f"engine-{machine}-apple-darwin"
    return "engine-x86_64-unknown-linux-gnu"


def main() -> None:
    engine_dir = Path(__file__).resolve().parent
    output_dir = engine_dir / "dist"

    command = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--onefile",
        "--name",
        "engine",
        "--collect-all",
        "LavaSR",
        "--distpath",
        str(output_dir),
        str(engine_dir / "run.py"),
    ]

    subprocess.run(command, check=True, cwd=engine_dir)

    built_binary = output_dir / ("engine.exe" if sys.platform == "win32" else "engine")
    copy2(built_binary, output_dir / tauri_sidecar_name())


if __name__ == "__main__":
    main()
