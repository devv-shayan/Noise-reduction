# Noise Reduction 🎧  

A local, privacy‑first desktop app for AI‑powered audio cleanup. Drop in a noisy recording — audio or video — and Noise Reduction runs a neural speech‑enhancement model entirely on your machine to produce a clean, denoised track. Nothing is uploaded; every step happens offline on your own CPU or GPU.  

---  

## 🎧 Hear the Difference  

A real before/after example produced by the app — same clip, noise removed. Click to download and listen (GitHub doesn't play `.wav` inline):

| | Sample |
|--------|--------|
| 🔊 **Before** (noisy) | [`8-speaker-before.wav`](samples/8-speaker-before.wav) |
| ✨ **After** (cleaned) | [`8-speaker-after-cleaned.wav`](samples/8-speaker-after-cleaned.wav) |

> Tip: download both and play them back to back to hear the background noise drop out while the speech stays clear.

---  

## 🎯 Overview  

Noise Reduction is a cross‑platform desktop application built on the Tauri sidecar pattern that:

- Accepts common audio and video files (WAV, MP3, M4A, FLAC, MP4, MOV, MKV, AVI)  
- Normalizes media with a bundled FFmpeg and feeds it to a local AI enhancement model  
- Removes background noise using the **LavaSR** speech‑enhancement model, running on CPU, CUDA, or Apple MPS  
- Previews results with an audible A/B clip and before/after waveform comparison  
- Runs fully offline — no accounts, no cloud, no data leaving your device  

---  

## 🏗️ System Architecture  

### The Sidecar Pattern  

```
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
```

1. **Tauri** owns the window, file pickers, app lifecycle, and spawning/monitoring the engine.  
2. **Python** runs as a hidden local FastAPI service on `http://127.0.0.1:8000`.  
3. The frontend talks to the engine through a Tauri command (`engine_request`).  
4. Python owns all audio processing and model execution — inference never moves into Rust or TypeScript.  

---  

## Key Components  

- **src/** – React + TypeScript frontend (Vite, Tailwind, shadcn/radix UI)  
  - `App.tsx` – app shell, bootstrap, and job/state orchestration  
  - `features/` – Process, Jobs, Settings views plus the sidebar  
  - `lib/engine-client.ts` – typed client for the FastAPI engine  
  - `lib/native.ts` – bridge to Tauri commands (file pickers, updates, logging)  

- **src‑tauri/** – Tauri v2 desktop shell  
  - `src/lib.rs` – sidecar lifecycle, port management, bootstrap, and engine proxy  

- **engine/** – Python FastAPI sidecar for audio processing  
  - `server.py` – HTTP API (health, setup, jobs, waveform preview)  
  - `audio_engine.py` – model management, FFmpeg normalization, enhancement, waveform analysis  
  - `run.py` – uvicorn entry point  
  - `build_sidecar.py` – PyInstaller packaging into a bundled binary  

- **tests/** – QA fixtures and audio samples  

---  

## 📋 Prerequisites  

- Node.js 18+ and npm  
- Rust toolchain (for Tauri v2) – install via `rustup`  
- Python 3.12+  
- `uv` (Python package manager)  
- Platform‑specific Tauri dependencies (WebView2 on Windows, build tools on macOS/Linux)  
- *Optional*: NVIDIA GPU (CUDA) or Apple Silicon (MPS) for faster inference  

---  

## 🚀 Installation & Setup  

1. **Clone the repository**  

   ```bash
   git clone <your-repo-url>
   cd Noise-reduction
   ```  

2. **Install frontend dependencies**  

   ```bash
   npm install
   ```  

3. **Install the Python engine**  
   This syncs the engine's virtual environment with `uv`, pulling in FastAPI, soundfile, imageio‑ffmpeg, and the LavaSR model package.  

   ```bash
   # Install uv if you don't have it (see https://docs.astral.sh/uv/)
   npm run engine:install
   ```  

4. **Build the sidecar** – package the Python engine into a standalone binary that Tauri can launch.  

   ```bash
   npm run engine:build
   ```  

---  

## 🔧 Usage  

### Run the Desktop App (Development)  

```bash
npm run tauri:dev
```  

Builds the sidecar and launches the Tauri dev shell with hot‑reloading frontend.  

### Build a Production Installer  

```bash
npm run tauri:build
```  

### Run the Engine Standalone  

Useful for backend development and debugging without the desktop shell:  

```bash
npm run engine:run
# Engine is now available at http://127.0.0.1:8000
```  

### Other Scripts  

- `npm run frontend:dev` – Vite dev server only  
- `npm run typecheck` – TypeScript type checking  
- `npm run check` – Typecheck + cargo check  

---  

## 🖥️ App Workflow  

1. **First‑Run Setup**  
   - On launch the app bootstraps the engine and checks whether the model is ready.  
   - If the model is not yet downloaded, the Process/Settings view offers a one‑click model setup.  
   - The model is cached locally under the app's cache directory and reused on future runs.  

2. **Process**  
   - Pick an input file (audio or video) and an output folder.  
   - Choose an output format (`wav` or `flac`) and compute preference (`auto`, `cpu`, or `gpu`).  
   - Start the job — processing runs as a background job with live stage and progress updates.  

3. **Preview & Compare**  
   - Generate a before/after waveform comparison and an audible, loudness‑matched A/B clip.  
   - The engine summarizes the change: estimated noise reduction (dB), loudness shift, peak/clipping checks, and a plain‑language verdict.  

4. **Jobs**  
   - Track queued, running, completed, failed, and cancelled jobs.  
   - Cancel an in‑progress job, or reveal a finished output file in the OS file manager.  

---  

## 🔌 Engine API Contract  

| Method | Endpoint                     | Purpose                                   |
|--------|------------------------------|-------------------------------------------|
| GET    | `/health`                    | Engine status and model readiness         |
| GET    | `/capabilities`              | Feature flags (used for engine compatibility checks) |
| GET    | `/setup/status`              | Model readiness, available compute backends, cache path |
| POST   | `/setup/model/download`      | Start background model download/load      |
| POST   | `/jobs`                      | Create a processing job                   |
| GET    | `/jobs/{id}`                 | Poll job status, stage, and progress      |
| POST   | `/jobs/{id}/cancel`          | Request cancellation of a running job     |
| POST   | `/preview/waveform`          | Before/after waveform + improvement analysis |

### Create‑job request body  

```json
{
  "input_path": "/absolute/path/to/noisy.wav",
  "output_dir": "/absolute/path/to/output",
  "output_format": "wav",
  "compute_preference": "auto"
}
```

---  

## 📁 Project Structure  

```
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
├── engine
