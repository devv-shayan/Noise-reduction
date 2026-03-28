from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from audio_engine import process_audio
from logging_config import configure_logging

configure_logging()
logger = logging.getLogger(__name__)

app = FastAPI(title="Noise Reduction Engine", version="0.1.0")


class ProcessRequest(BaseModel):
    input_path: str
    output_path: str


class ProcessResponse(BaseModel):
    status: str
    file: str


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/process", response_model=ProcessResponse)
def process(request: ProcessRequest) -> ProcessResponse:
    input_path = Path(request.input_path).expanduser().resolve()
    output_path = Path(request.output_path).expanduser().resolve()

    logger.info("Received process request for %s", input_path)

    try:
        saved_path = process_audio(input_path=input_path, output_path=output_path)
    except FileNotFoundError as error:
        logger.exception("Input file was not found")
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as error:
        logger.exception("Unhandled processing failure")
        raise HTTPException(status_code=500, detail="Audio processing failed") from error

    return ProcessResponse(status="success", file=str(saved_path))
