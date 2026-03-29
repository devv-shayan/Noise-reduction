# Noise Reduction

Local desktop app scaffold for AI-assisted audio cleanup. The repository follows the architecture discussed in planning:

- `src/`: React + TypeScript frontend
- `src-tauri/`: Tauri v2 desktop shell
- `engine/`: Python FastAPI sidecar for audio processing
- `tests/`: QA fixtures and integration samples

## Current Status

This repo now includes:

- a shadcn `radix-nova` desktop UI shell with Process, Jobs, and Settings views
- a Tauri v2 bootstrap command and sidecar lifecycle wiring
- a FastAPI engine with model setup, background jobs, and media normalization
- build scripts for the frontend, Tauri shell, and Python sidecar

## Next Steps

1. Run `npm run engine:install` to create/sync the engine environment with `uv`.
2. Build the sidecar with `npm run engine:build`.
3. Start the desktop app with `npm run tauri:dev`.
4. Replace the placeholder app icons and configure updater signing before shipping installers.
