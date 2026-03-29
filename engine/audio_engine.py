from __future__ import annotations

import os
import base64
import io
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Callable

import imageio_ffmpeg
import numpy as np
import soundfile as sf


MODEL_REPOSITORY = "YatharthS/LavaSR"
SUPPORTED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".flac"}
SUPPORTED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".mkv", ".avi"}


class ProcessingCancelledError(RuntimeError):
    pass


@dataclass(slots=True)
class ModelStatus:
    ready: bool
    loading: bool
    last_error: str | None
    active_backend: str | None


@dataclass(slots=True)
class WaveformPreviewData:
    points: list[float]
    duration_seconds: float
    peak_level: float
    rms_db: float
    noise_floor_db: float
    focus_start_seconds: float
    focus_duration_seconds: float
    clip_data_url: str


class ModelManager:
    def __init__(self, model_dir: Path) -> None:
        self._model_dir = model_dir
        self._model_dir.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        self._model = None
        self._loading = False
        self._last_error: str | None = None
        self._active_backend: str | None = None

    def available_backends(self) -> list[str]:
        import torch

        backends = ["cpu"]
        if torch.cuda.is_available():
            backends.insert(0, "cuda")
        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            backends.insert(0, "mps")
        return backends

    def status(self) -> ModelStatus:
        return ModelStatus(
            ready=self._model is not None,
            loading=self._loading,
            last_error=self._last_error,
            active_backend=self._active_backend,
        )

    def ensure_loaded(self, preferred_backend: str) -> tuple[object, str]:
        if self._model is not None and self._active_backend is not None:
            return self._model, self._active_backend

        with self._lock:
            if self._model is not None and self._active_backend is not None:
                return self._model, self._active_backend

            self._loading = True
            self._last_error = None

            try:
                backend = self._select_backend(preferred_backend)

                os.environ.setdefault("HF_HOME", str(self._model_dir / "hf"))
                os.environ.setdefault("HUGGINGFACE_HUB_CACHE", str(self._model_dir / "hf"))

                from LavaSR.model import LavaEnhance2

                self._model = LavaEnhance2(MODEL_REPOSITORY, backend)
                self._active_backend = backend
                return self._model, backend
            except Exception as error:  # pragma: no cover - runtime integration
                self._last_error = str(error)
                raise
            finally:
                self._loading = False

    def _select_backend(self, preferred_backend: str) -> str:
        available = self.available_backends()
        if preferred_backend == "gpu":
            for backend in ("cuda", "mps"):
                if backend in available:
                    return backend
            return "cpu"
        if preferred_backend in available:
            return preferred_backend
        return available[0]


def media_type_for_path(input_path: Path) -> str:
    suffix = input_path.suffix.lower()
    if suffix in SUPPORTED_AUDIO_EXTENSIONS:
        return "audio"
    if suffix in SUPPORTED_VIDEO_EXTENSIONS:
        return "video"
    raise ValueError(f"Unsupported media type: {input_path.suffix}")


def extract_input_to_wav(input_path: Path, temp_dir: Path) -> Path:
    ffmpeg_path = Path(imageio_ffmpeg.get_ffmpeg_exe())
    temp_output_path = temp_dir / "normalized-input.wav"

    command = [
        str(ffmpeg_path),
        "-y",
        "-i",
        str(input_path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        str(temp_output_path),
    ]

    completed = subprocess.run(
        command,
        capture_output=True,
        check=False,
        text=True,
    )

    if completed.returncode != 0:
        raise RuntimeError(
            completed.stderr.strip() or "FFmpeg failed to normalize the input media."
        )

    return temp_output_path


def summarize_waveform(samples: np.ndarray, bins: int = 96) -> list[float]:
    if samples.ndim > 1:
        samples = samples.mean(axis=1)

    if samples.size == 0:
        return [0.0 for _ in range(bins)]

    peaks: list[float] = []
    sample_count = samples.shape[0]

    for index in range(bins):
        start = int(index * sample_count / bins)
        end = int((index + 1) * sample_count / bins)
        window = samples[start:end]

        if window.size == 0:
            peaks.append(0.0)
            continue

        amplitude = float(np.max(np.abs(window)))
        peaks.append(round(min(amplitude, 1.0), 4))

    return peaks


def rms_db(samples: np.ndarray) -> float:
    if samples.size == 0:
        return -90.0

    rms = float(np.sqrt(np.mean(np.square(samples), dtype=np.float64)))
    return round(20.0 * np.log10(max(rms, 1e-6)), 1)


def noise_floor_db(samples: np.ndarray, sample_rate: int) -> float:
    if samples.size == 0:
        return -90.0

    window_size = max(sample_rate // 20, 1)
    floors: list[float] = []

    for start in range(0, samples.shape[0], window_size):
        window = samples[start : start + window_size]
        if window.size == 0:
            continue
        floors.append(float(np.sqrt(np.mean(np.square(window), dtype=np.float64))))

    if not floors:
        return -90.0

    floor_value = float(np.percentile(np.array(floors, dtype=np.float32), 20))
    return round(20.0 * np.log10(max(floor_value, 1e-6)), 1)


def find_focus_start(samples: np.ndarray, sample_rate: int, clip_duration_seconds: float) -> float:
    if samples.size == 0:
        return 0.0

    clip_samples = max(int(sample_rate * clip_duration_seconds), 1)
    if samples.shape[0] <= clip_samples:
        return 0.0

    hop_size = max(sample_rate // 2, 1)
    best_index = 0
    best_score = -1.0

    for start in range(0, samples.shape[0] - clip_samples, hop_size):
        segment = samples[start : start + clip_samples]
        score = float(np.mean(np.abs(np.diff(segment))))
        if score > best_score:
            best_score = score
            best_index = start

    return round(best_index / sample_rate, 2)


def clip_preview_segment(
    samples: np.ndarray,
    sample_rate: int,
    start_seconds: float,
    duration_seconds: float,
) -> np.ndarray:
    start_index = max(int(start_seconds * sample_rate), 0)
    end_index = min(int((start_seconds + duration_seconds) * sample_rate), samples.shape[0])
    return samples[start_index:end_index]


def loudness_match_clip(samples: np.ndarray, target_rms: float = 0.12) -> np.ndarray:
    if samples.size == 0:
        return samples

    current_rms = float(np.sqrt(np.mean(np.square(samples), dtype=np.float64)))
    if current_rms <= 1e-6:
        return samples

    scaled = samples * (target_rms / current_rms)
    peak = float(np.max(np.abs(scaled)))
    if peak > 0.95:
        scaled = scaled * (0.95 / peak)
    return scaled.astype(np.float32)


def wav_data_url(samples: np.ndarray, sample_rate: int) -> str:
    buffer = io.BytesIO()
    sf.write(buffer, samples, sample_rate, format="WAV", subtype="PCM_16")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:audio/wav;base64,{encoded}"


def normalized_audio_for_path(input_path: Path) -> tuple[np.ndarray, int]:
    with tempfile.TemporaryDirectory(prefix="noise-preview-") as temp_dir_value:
        temp_dir = Path(temp_dir_value)
        normalized_input = extract_input_to_wav(input_path, temp_dir)
        samples, sample_rate = sf.read(str(normalized_input), dtype="float32")

        if getattr(samples, "ndim", 1) > 1:
            samples = samples.mean(axis=1)

        return samples, sample_rate


def waveform_preview_for_path(
    input_path: Path,
    bins: int = 96,
    focus_start_seconds: float | None = None,
    focus_duration_seconds: float = 3.5,
) -> WaveformPreviewData:
    samples, sample_rate = normalized_audio_for_path(input_path)
    duration_seconds = float(samples.shape[0] / sample_rate) if sample_rate else 0.0
    peak_level = float(np.max(np.abs(samples))) if samples.size else 0.0
    resolved_focus_start = (
        focus_start_seconds
        if focus_start_seconds is not None
        else find_focus_start(samples, sample_rate, focus_duration_seconds)
    )
    clip = clip_preview_segment(samples, sample_rate, resolved_focus_start, focus_duration_seconds)
    matched_clip = loudness_match_clip(clip)

    return WaveformPreviewData(
        points=summarize_waveform(samples, bins),
        duration_seconds=duration_seconds,
        peak_level=round(min(peak_level, 1.0), 4),
        rms_db=rms_db(samples),
        noise_floor_db=noise_floor_db(samples, sample_rate),
        focus_start_seconds=resolved_focus_start,
        focus_duration_seconds=round(min(focus_duration_seconds, duration_seconds or focus_duration_seconds), 2),
        clip_data_url=wav_data_url(matched_clip, sample_rate),
    )


def enhance_to_output(
    *,
    input_path: Path,
    output_dir: Path,
    output_format: str,
    compute_preference: str,
    model_manager: ModelManager,
    stage_callback: Callable[[str, int], None],
    cancel_check: Callable[[], None],
) -> tuple[Path, str, str]:
    media_type = media_type_for_path(input_path)
    output_extension = output_format.lower()
    output_path = output_dir / f"{input_path.stem}-cleaned.{output_extension}"
    output_dir.mkdir(parents=True, exist_ok=True)

    stage_callback("preparing", 10)
    cancel_check()

    with tempfile.TemporaryDirectory(prefix="noise-reduction-") as temp_dir_value:
        temp_dir = Path(temp_dir_value)

        stage_callback("extracting", 25)
        normalized_input = extract_input_to_wav(input_path, temp_dir)
        cancel_check()

        stage_callback("running-inference", 60)
        lava_model, backend = model_manager.ensure_loaded(compute_preference)
        input_audio, _ = lava_model.load_audio(str(normalized_input), input_sr=16000)
        duration_seconds = sf.info(normalized_input).duration
        enhanced_audio = (
            lava_model.enhance(
                input_audio,
                denoise=True,
                batch=duration_seconds > 180,
            )
            .cpu()
            .numpy()
            .squeeze()
        )
        cancel_check()

        stage_callback("encoding", 90)
        sf.write(str(output_path), enhanced_audio, 48000, format=output_extension.upper())

    stage_callback("completed", 100)
    return output_path, backend, media_type
