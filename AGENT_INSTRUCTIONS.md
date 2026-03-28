# Noise Reduction - Architecture Rules

You are working inside a production-oriented desktop application for local AI audio cleanup.

## 1. Tech Stack

- Frontend: React, TypeScript, Vite
- Styling: Tailwind CSS or a lightweight design system layered on top of Vite
- Desktop shell: Tauri v2
- AI engine: Python 3.11, FastAPI, PyTorch, numpy, soundfile
- Packaging: PyInstaller for the Python sidecar, Tauri Builder for the desktop app

## 2. System Architecture

We use the sidecar pattern.

1. Tauri manages the window, system integration, file selection, and app lifecycle.
2. Python runs as a hidden local FastAPI service.
3. The frontend communicates with the Python service over `http://127.0.0.1:8000`.
4. Python owns all audio processing and model execution.

## 3. Hard Rules

- Do not move inference into Rust or TypeScript.
- Do not replace the sidecar pattern.
- Do not introduce Electron or a Node.js backend.
- Keep frontend, shell, and engine concerns separate.
- Log Python engine failures to a local file under `engine/logs/`.

## 4. Repository Layout

```text
/src               React UI
/src-tauri         Tauri shell
/engine            FastAPI sidecar and model integration
/tests             Audio fixtures and QA assets
```

## 5. API Contract

Primary endpoint:

- `POST /process`
- Input:
  - `{ "input_path": "/absolute/path/to/noisy.wav", "output_path": "/absolute/path/to/clean.wav" }`
- Output:
  - `{ "status": "success", "file": "/absolute/path/to/clean.wav" }`

## 6. Delivery Sequence

1. Make the Python engine work with a dummy copy-based processor.
2. Connect the frontend form to the local API.
3. Spawn and monitor the sidecar from Tauri.
4. Package the sidecar into the desktop build.

