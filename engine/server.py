from __future__ import annotations

import logging
import os
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from threading import Event, Lock, Thread
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from audio_engine import (
    MODEL_REPOSITORY,
    ModelManager,
    ProcessingCancelledError,
    enhance_to_output,
    waveform_preview_for_path,
)
from logging_config import configure_logging

configure_logging()
logger = logging.getLogger(__name__)

VERSION = "0.1.0"
LOG_DIR = Path(os.environ.get("NOISE_REDUCTION_LOG_DIR", Path(__file__).resolve().parent / "logs"))
MODEL_DIR = Path(
    os.environ.get("NOISE_REDUCTION_MODEL_DIR", Path(__file__).resolve().parent / "model")
)

MODEL_MANAGER = ModelManager(MODEL_DIR)
JOBS_LOCK = Lock()
JOBS: dict[str, "JobRecord"] = {}
CANCEL_EVENTS: dict[str, Event] = {}

app = FastAPI(title="Noise Reduction Engine", version=VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def iso_now() -> str:
    return datetime.now(tz=UTC).isoformat()


@dataclass(slots=True)
class JobRecord:
    id: str
    status: str
    stage: str
    progress: int
    input_path: str
    output_path: str | None
    output_format: str
    created_at: str
    updated_at: str
    media_type: str
    compute_backend: str | None
    error: str | None


class EngineHealthResponse(BaseModel):
    status: str
    version: str
    model_ready: bool


class SetupStatusResponse(BaseModel):
    model_ready: bool
    model_version: str | None
    compute_backends: list[str]
    cache_path: str
    download_required: bool
    loading: bool
    active_backend: str | None
    last_error: str | None


class DownloadModelResponse(BaseModel):
    status: str


class CreateJobRequest(BaseModel):
    input_path: str
    output_dir: str
    output_format: str = Field(pattern="^(wav|flac)$")
    compute_preference: str = Field(pattern="^(auto|cpu|gpu)$")


class CreateJobResponse(BaseModel):
    job_id: str


class JobResponse(BaseModel):
    id: str
    status: str
    stage: str
    progress: int
    input_path: str
    output_path: str | None
    output_format: str
    created_at: str
    updated_at: str
    media_type: str
    compute_backend: str | None
    error: str | None


class WaveformPreviewResponse(BaseModel):
    points: list[float]
    duration_seconds: float
    peak_level: float
    rms_db: float
    noise_floor_db: float
    focus_start_seconds: float
    focus_duration_seconds: float
    clip_data_url: str


class PreviewWaveformRequest(BaseModel):
    input_path: str
    output_path: str | None = None
    bins: int = Field(default=96, ge=24, le=256)


class PreviewWaveformResponse(BaseModel):
    before: WaveformPreviewResponse
    after: WaveformPreviewResponse | None
    improvement: "WaveformImprovementResponse | None"


class WaveformImprovementResponse(BaseModel):
    verdict: str
    summary: list[str]
    noise_reduction_db: float
    loudness_change_db: float
    peak_change_percent: float
    clipping_before: bool
    clipping_after: bool
    focus_start_seconds: float
    focus_duration_seconds: float


class CapabilitiesResponse(BaseModel):
    waveform_preview: bool


def serialize_job(job: JobRecord) -> JobResponse:
    return JobResponse(**asdict(job))


def update_job(job_id: str, **changes: object) -> JobRecord:
    with JOBS_LOCK:
        job = JOBS[job_id]
        for key, value in changes.items():
            setattr(job, key, value)
        job.updated_at = iso_now()
        return job


def background_model_setup() -> None:
    try:
        MODEL_MANAGER.ensure_loaded("auto")
    except Exception:
        logger.exception("Model setup failed")


def process_job(job_id: str, request: CreateJobRequest) -> None:
    cancel_event = CANCEL_EVENTS[job_id]

    def cancel_check() -> None:
        if cancel_event.is_set():
            raise ProcessingCancelledError("The job was cancelled.")

    def stage_callback(stage: str, progress: int) -> None:
        update_job(job_id, stage=stage, progress=progress, status="running")

    try:
        output_path, backend, media_type = enhance_to_output(
            input_path=Path(request.input_path),
            output_dir=Path(request.output_dir),
            output_format=request.output_format,
            compute_preference=request.compute_preference,
            model_manager=MODEL_MANAGER,
            stage_callback=stage_callback,
            cancel_check=cancel_check,
        )

        update_job(
            job_id,
            status="completed",
            stage="completed",
            progress=100,
            output_path=str(output_path),
            compute_backend=backend,
            media_type=media_type,
        )
    except ProcessingCancelledError as error:
        update_job(
            job_id,
            status="cancelled",
            stage="cancelled",
            error=str(error),
            progress=0,
        )
    except Exception as error:
        logger.exception("Processing job %s failed", job_id)
        update_job(
            job_id,
            status="failed",
            stage="failed",
            error=str(error),
        )
    finally:
        with JOBS_LOCK:
            CANCEL_EVENTS.pop(job_id, None)


@app.get("/health", response_model=EngineHealthResponse)
def health_check() -> EngineHealthResponse:
    return EngineHealthResponse(
        status="ok",
        version=VERSION,
        model_ready=MODEL_MANAGER.status().ready,
    )


@app.get("/capabilities", response_model=CapabilitiesResponse)
def capabilities() -> CapabilitiesResponse:
    return CapabilitiesResponse(waveform_preview=True)


@app.get("/setup/status", response_model=SetupStatusResponse)
def setup_status() -> SetupStatusResponse:
    model_status = MODEL_MANAGER.status()
    return SetupStatusResponse(
        model_ready=model_status.ready,
        model_version=MODEL_REPOSITORY if model_status.ready else None,
        compute_backends=MODEL_MANAGER.available_backends(),
        cache_path=str(MODEL_DIR),
        download_required=not model_status.ready,
        loading=model_status.loading,
        active_backend=model_status.active_backend,
        last_error=model_status.last_error,
    )


@app.post("/setup/model/download", response_model=DownloadModelResponse)
def start_model_download() -> DownloadModelResponse:
    model_status = MODEL_MANAGER.status()
    if model_status.ready:
        return DownloadModelResponse(status="ready")

    if not model_status.loading:
        Thread(target=background_model_setup, daemon=True).start()

    return DownloadModelResponse(status="started")


@app.post("/jobs", response_model=CreateJobResponse)
def create_job(request: CreateJobRequest) -> CreateJobResponse:
    input_path = Path(request.input_path).expanduser().resolve()
    if not input_path.exists():
        raise HTTPException(status_code=404, detail=f"Input file does not exist: {input_path}")

    output_dir = Path(request.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    job_id = uuid4().hex
    created_at = iso_now()
    job = JobRecord(
        id=job_id,
        status="queued",
        stage="queued",
        progress=0,
        input_path=str(input_path),
        output_path=None,
        output_format=request.output_format,
        created_at=created_at,
        updated_at=created_at,
        media_type="audio",
        compute_backend=None,
        error=None,
    )

    with JOBS_LOCK:
        JOBS[job_id] = job
        CANCEL_EVENTS[job_id] = Event()

    Thread(target=process_job, args=(job_id, request), daemon=True).start()
    return CreateJobResponse(job_id=job_id)


@app.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(job_id: str) -> JobResponse:
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail=f"Unknown job id: {job_id}")
        return serialize_job(job)


@app.post("/jobs/{job_id}/cancel", response_model=JobResponse)
def cancel_job(job_id: str) -> JobResponse:
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail=f"Unknown job id: {job_id}")
        cancel_event = CANCEL_EVENTS.get(job_id)

    if cancel_event:
        cancel_event.set()

    return serialize_job(update_job(job_id, stage="cancelling"))


def build_waveform_response(preview) -> WaveformPreviewResponse:
    return WaveformPreviewResponse(
        points=preview.points,
        duration_seconds=preview.duration_seconds,
        peak_level=preview.peak_level,
        rms_db=preview.rms_db,
        noise_floor_db=preview.noise_floor_db,
        focus_start_seconds=preview.focus_start_seconds,
        focus_duration_seconds=preview.focus_duration_seconds,
        clip_data_url=preview.clip_data_url,
    )


def build_improvement_response(before, after) -> WaveformImprovementResponse:
    noise_reduction_db = round(before.noise_floor_db - after.noise_floor_db, 1)
    loudness_change_db = round(after.rms_db - before.rms_db, 1)
    peak_change_percent = round((before.peak_level - after.peak_level) * 100, 1)
    clipping_before = before.peak_level >= 0.98
    clipping_after = after.peak_level >= 0.98

    if noise_reduction_db >= 6:
        verdict = "Big improvement"
    elif noise_reduction_db >= 3:
        verdict = "Noticeable improvement"
    elif noise_reduction_db >= 1.5:
        verdict = "Small improvement"
    elif noise_reduction_db > 0.3:
        verdict = "Very small improvement"
    else:
        verdict = "Little change"

    if noise_reduction_db > 0.3:
        noise_summary = f"Estimated background noise was reduced by {noise_reduction_db:.1f} dB."
    elif noise_reduction_db < -0.3:
        noise_summary = f"Background noise appears slightly higher by {abs(noise_reduction_db):.1f} dB."
    else:
        noise_summary = "Background noise stayed about the same."

    if abs(loudness_change_db) <= 1.5:
        loudness_summary = "Overall volume stayed similar."
    elif loudness_change_db > 1.5:
        loudness_summary = "The cleaned audio sounds a bit louder."
    else:
        loudness_summary = "The cleaned audio sounds a bit softer."

    if clipping_after:
        peak_summary = "The cleaned preview still has very strong peaks."
    elif peak_change_percent > 1.0:
        peak_summary = f"Peak spikes are about {peak_change_percent:.1f}% lower in the cleaned preview."
    else:
        peak_summary = "No clipping detected in the cleaned preview."

    return WaveformImprovementResponse(
        verdict=verdict,
        summary=[
            noise_summary,
            loudness_summary,
            peak_summary,
        ],
        noise_reduction_db=noise_reduction_db,
        loudness_change_db=loudness_change_db,
        peak_change_percent=peak_change_percent,
        clipping_before=clipping_before,
        clipping_after=clipping_after,
        focus_start_seconds=before.focus_start_seconds,
        focus_duration_seconds=before.focus_duration_seconds,
    )


@app.post("/preview/waveform", response_model=PreviewWaveformResponse)
def preview_waveform(request: PreviewWaveformRequest) -> PreviewWaveformResponse:
    input_path = Path(request.input_path).expanduser().resolve()
    if not input_path.exists():
        raise HTTPException(status_code=404, detail=f"Input file does not exist: {input_path}")

    before_preview = waveform_preview_for_path(
        input_path,
        request.bins,
    )

    after_preview = None
    if request.output_path:
        output_path = Path(request.output_path).expanduser().resolve()
        if output_path.exists():
            after_preview = waveform_preview_for_path(
                output_path,
                request.bins,
                focus_start_seconds=before_preview.focus_start_seconds,
                focus_duration_seconds=before_preview.focus_duration_seconds,
            )

    return PreviewWaveformResponse(
        before=build_waveform_response(before_preview),
        after=build_waveform_response(after_preview) if after_preview else None,
        improvement=build_improvement_response(before_preview, after_preview)
        if after_preview
        else None,
    )
