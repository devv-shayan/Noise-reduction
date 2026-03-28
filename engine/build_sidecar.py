from __future__ import annotations

import subprocess
import sys
from pathlib import Path


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
        "--distpath",
        str(output_dir),
        str(engine_dir / "run.py"),
    ]

    subprocess.run(command, check=True, cwd=engine_dir)


if __name__ == "__main__":
    main()

