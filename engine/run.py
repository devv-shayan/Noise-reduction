from __future__ import annotations

import argparse

import uvicorn
from server import app


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    arguments = parser.parse_args()
    uvicorn.run(app, host="127.0.0.1", port=arguments.port, reload=False)


if __name__ == "__main__":
    main()
