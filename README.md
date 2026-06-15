Noise Reduction 🎧
A local, privacy-first desktop app for AI-powered audio cleanup. Drop in a noisy recording — audio or video — and Noise Reduction runs a neural speech-enhancement model entirely on your machine to produce a clean, denoised track. Nothing is uploaded; every step happens offline on your own CPU or GPU.

🎯 Overview
Noise Reduction is a cross-platform desktop application built on the Tauri sidecar pattern that:

Accepts common audio and video files (WAV, MP3, M4A, FLAC, MP4, MOV, MKV, AVI)
Normalizes media with a bundled FFmpeg and feeds it to a local AI enhancement model
Removes background noise using the LavaSR speech-enhancement model, running on CPU, CUDA, or Apple MPS
Previews results with an audible A/B clip and before/after waveform comparison
Runs fully offline — no accounts, no cloud, no data leaving your device
🏗️ System Architecture
The Sidecar Pattern
┌──────────────────┐    ┌──────────────────┐    ┌───────────────────┐
│ React + TS UI    │ -> │ Tauri v2 Shell   │ -> │ FastAPI Engine    │
│ (Process, Jobs,  │    │ (window, files,  │    │ (local sidecar    │
│  Settings views) │    │  sidecar spawn)  │    │  on 127.0.0.1)    │
└──────────────────┘    └──────────────────┘    └─────────┬─────────┘
                                                          │
                                                          v
                                            ┌───────────────────────────┐
                                            │ Audio Engine               │
                                            │ FFmpeg → LavaSR → soundfile│
                                            └───────────────────────────┘

1. Tauri owns the window, file pickers, app lifecycle, and spawning/monitoring the engine.
2. Python runs as a hidden local FastAPI service on http://127.0.0.1:8000.
3. The frontend talks to the engine through a Tauri command (engine_request).
4. Python owns all audio processing and model execution — inference never moves into Rust or TypeScript.

Key Components
src/: React + TypeScript frontend (Vite, Tailwind, shadcn/radix UI)
  App.tsx: app shell, bootstrap, and job/state orchestration
  features/: Process, Jobs, and Settings views plus the sidebar
  lib/engine-client.ts: typed client for the FastAPI engine
  lib/native.ts: bridge to Tauri commands (file pickers, updates, logging)
src-tauri/: Tauri v2 desktop shell
  src/lib.rs: sidecar lifecycle, port management, bootstrap, and engine proxy
engine/: Python FastAPI sidecar for audio processing
  server.py: HTTP API (health, setup, jobs, waveform preview)
  audio_engine.py: model management, FFmpeg normalization, enhancement, waveform analysis
  run.py: uvicorn entry point
  build_sidecar.py: PyInstaller packaging into a bundled binary
tests/: QA fixtures and audio samples

📋 Prerequisites
Node.js 18+ and npm
Rust toolchain (for Tauri v2) — install via rustup
Python 3.12+
uv (Python package manager)
Platform Tauri dependencies (WebView2 on Windows, build tools on macOS/Linux)
Optional: an NVIDIA GPU (CUDA) or Apple Silicon (MPS) for faster inference
🚀 Installation & Setup
1. Clone the Repository
git clone <your-repo-url>
cd Noise-reduction
2. Install Frontend Dependencies
npm install
3. Install the Python Engine
This syncs the engine's virtual environment with uv, pulling in FastAPI, soundfile, imageio-ffmpeg, and the LavaSR model package.

# Install uv if you don't have it (see https://docs.astral.sh/uv/)
npm run engine:install
4. Build the Sidecar
Package the Python engine into a standalone binary that Tauri can launch.

npm run engine:build
🔧 Usage
Run the Desktop App (Development)
Builds the sidecar and launches the Tauri dev shell with hot-reloading frontend:

npm run tauri:dev
Build a Production Installer
npm run tauri:build
Run the Engine Standalone
Useful for backend development and debugging without the desktop shell:

npm run engine:run
# Engine is now available at http://127.0.0.1:8000

Other Scripts
npm run frontend:dev   # Vite dev server only
npm run typecheck      # TypeScript type checking
npm run check          # Typecheck + cargo check

🖥️ App Workflow
1. First-Run Setup
On launch the app bootstraps the engine and checks whether the model is ready.
If the model is not yet downloaded, the Process/Settings view offers a one-click model setup.
The model is cached locally under the app's cache directory and reused on future runs.
2. Process
Pick an input file (audio or video) and an output folder.
Choose an output format (wav or flac) and compute preference (auto, cpu, or gpu).
Start the job — processing runs as a background job with live stage and progress updates.
3. Preview & Compare
Generate a before/after waveform comparison and an audible, loudness-matched A/B clip.
The engine summarizes the change: estimated noise reduction (dB), loudness shift, peak/clipping checks, and a plain-language verdict.
4. Jobs
Track queued, running, completed, failed, and cancelled jobs.
Cancel an in-progress job, or reveal a finished output file in the OS file manager.

🔌 Engine API Contract
The FastAPI sidecar exposes a small local API consumed by the frontend:

Method	Endpoint	Purpose
GET	/health	Engine status and model readiness
GET	/capabilities	Feature flags (used for engine compatibility checks)
GET	/setup/status	Model readiness, available compute backends, cache path
POST	/setup/model/download	Start background model download/load
POST	/jobs	Create a processing job
GET	/jobs/{id}	Poll job status, stage, and progress
POST	/jobs/{id}/cancel	Request cancellation of a running job
POST	/preview/waveform	Before/after waveform + improvement analysis

Create-job request body:

{
  "input_path": "/absolute/path/to/noisy.wav",
  "output_dir": "/absolute/path/to/output",
  "output_format": "wav",
  "compute_preference": "auto"
}

📁 Project Structure
Noise-reduction/
├── src/                       # React + TypeScript frontend
│   ├── App.tsx                # App shell and orchestration
│   ├── features/              # Process, Jobs, Settings, sidebar
│   ├── lib/                   # engine-client, native bridge, types, settings
│   ├── components/            # shadcn/radix UI primitives
│   └── index.css              # Tailwind + design tokens
├── src-tauri/                 # Tauri v2 desktop shell
│   ├── src/lib.rs             # Sidecar lifecycle, bootstrap, engine proxy
│   ├── src/main.rs            # Binary entry point
│   └── Cargo.toml             # Rust dependencies
├── engine/                    # Python FastAPI sidecar
│   ├── server.py              # HTTP API
│   ├── audio_engine.py        # Model + FFmpeg + enhancement + analysis
│   ├── run.py                 # uvicorn entry point
│   ├── build_sidecar.py       # PyInstaller packaging
│   ├── logging_config.py      # Logging setup
│   ├── logs/                  # Engine log files
│   ├── model/                 # Local model cache
│   └── pyproject.toml         # Engine dependencies
├── tests/                     # QA fixtures and audio samples
├── package.json               # npm scripts and frontend deps
├── AGENT_INSTRUCTIONS.md      # Architecture rules
└── README.md                  # This file

🛠️ Configuration
Model
The app uses the LavaSR speech-enhancement model (YatharthS/LavaSR), loaded via the LavaSR Python package. The model is downloaded on first setup and cached locally; no API key is required.

Compute Backends
The engine auto-detects available backends and selects one based on your preference:

auto: prefers GPU (CUDA/MPS) when available, falls back to CPU
gpu: forces CUDA or Apple MPS when present, otherwise CPU
cpu: always uses the CPU
Settings
User settings (theme, compute preference, default output format, auto-update) persist locally and are managed in the Settings view.

📈 Logging
Engine logs: written under engine/logs/ (and the app's per-user log directory in packaged builds).
Desktop bootstrap logs: the Tauri shell records sidecar lifecycle events (spawn, port checks, engine stdout/stderr) to desktop-bootstrap.log.
Background jobs: each job tracks its stage and progress, surfaced live in the UI.
🚨 Troubleshooting
1. Engine won't start / port 8000 in use

The shell detects a stale process on port 8000 and attempts to stop it automatically. If it persists, close any old app instance and relaunch. Check desktop-bootstrap.log for details.

2. Model setup fails or stalls

Verify your internet connection for the first download. Subsequent runs use the local cache. Check engine/logs/ and the Settings view for the last error reported by the engine.

3. "Unsupported media type"

Confirm the input is one of the supported formats: audio (.wav, .mp3, .m4a, .flac) or video (.mp4, .mov, .mkv, .avi).

4. Slow processing

CPU inference on long files is slow by design. Set the compute preference to gpu (or auto) if you have a CUDA or Apple Silicon device. Files longer than ~3 minutes are processed in batches.

5. Sidecar not found in dev

Run npm run engine:build before npm run tauri:dev so the bundled engine binary exists. The combined npm run tauri:dev script does this for you.

🤝 Contributing
Fork the repository
Create a feature branch (git checkout -b feature/amazing-feature)
Keep frontend, shell, and engine concerns separate (see AGENT_INSTRUCTIONS.md)
Run npm run check before committing
Commit your changes (git commit -m 'Add amazing feature')
Push to the branch (git push origin feature/amazing-feature)
Open a Pull Request
Architecture rules:

Do not move inference into Rust or TypeScript.
Do not replace the sidecar pattern, and do not introduce Electron or a Node.js backend.
Log Python engine failures to engine/logs/.
📄 License
This project is licensed under the MIT License — see the LICENSE file for details.

🙏 Acknowledgments
LavaSR — neural speech-enhancement model powering the cleanup
Tauri — lightweight, secure desktop shell
FastAPI & uvicorn — the local engine
FFmpeg (via imageio-ffmpeg) — media normalization
shadcn/ui & Radix — frontend components
📞 Support
For issues and questions:

Create an issue on GitHub
Review the troubleshooting section
Check the logs in engine/logs/ and desktop-bootstrap.log
Built with ❤️ by Shayan Khan

Clean audio, on your own machine — no cloud required.
