# Noise Reduction

Local desktop app scaffold for AI-assisted audio cleanup. The repository follows the architecture discussed in planning:

- `src/`: React + TypeScript frontend
- `src-tauri/`: Tauri v2 desktop shell
- `engine/`: Python FastAPI sidecar for audio processing
- `tests/`: QA fixtures and integration samples

## Current Status

This is a structure-first scaffold. It includes:

- architecture and agent rules
- a minimal React UI that talks to a local FastAPI endpoint
- a Tauri shell skeleton for the desktop wrapper
- a Python sidecar with a dummy processing pipeline that copies files

## Next Steps

1. Install frontend and Tauri dependencies.
2. Create a Python virtual environment inside `engine/.venv`.
3. Replace the dummy `process_audio` implementation with LavaSR inference.
4. Wire the packaged Python sidecar into `src-tauri/tauri.conf.json`.

