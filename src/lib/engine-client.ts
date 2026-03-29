import { invoke } from "@tauri-apps/api/core";

import type {
  BootstrapPayload,
  CreateJobInput,
  CreateJobResponse,
  DownloadModelResponse,
  EngineHealth,
  EngineSetupStatus,
  ProcessingJob,
} from "@/lib/types";

type EngineHealthWire = {
  status: "ok" | "offline";
  version: string;
  model_ready: boolean;
};

type EngineSetupStatusWire = {
  model_ready: boolean;
  model_version: string | null;
  compute_backends: string[];
  cache_path: string;
  download_required: boolean;
  loading: boolean;
  active_backend: string | null;
  last_error: string | null;
};

type CreateJobResponseWire = {
  job_id: string;
};

type ProcessingJobWire = {
  id: string;
  status: ProcessingJob["status"];
  stage: string;
  progress: number;
  input_path: string;
  output_path: string | null;
  output_format: ProcessingJob["outputFormat"];
  created_at: string;
  updated_at: string;
  media_type: ProcessingJob["mediaType"];
  compute_backend: string | null;
  error: string | null;
};

async function logClientEvent(level: string, message: string) {
  if (!isTauriRuntime()) {
    return;
  }

  try {
    await invoke("log_client_event", { level, message });
  } catch {
    // Ignore logging failures to avoid masking the real bootstrap error.
  }
}

function baseUrl(engineBaseUrl?: string) {
  if (engineBaseUrl) {
    return engineBaseUrl;
  }

  return "http://127.0.0.1:8000";
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(errorPayload || `Engine request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

function toEngineHealth(payload: EngineHealthWire): EngineHealth {
  return {
    status: payload.status,
    version: payload.version,
    modelReady: payload.model_ready,
  };
}

function toSetupStatus(payload: EngineSetupStatusWire): EngineSetupStatus {
  return {
    modelReady: payload.model_ready,
    modelVersion: payload.model_version,
    computeBackends: payload.compute_backends ?? [],
    cachePath: payload.cache_path,
    downloadRequired: payload.download_required,
    loading: payload.loading,
    activeBackend: payload.active_backend,
    lastError: payload.last_error,
  };
}

function toCreateJobResponse(payload: CreateJobResponseWire): CreateJobResponse {
  return {
    jobId: payload.job_id,
  };
}

function toProcessingJob(payload: ProcessingJobWire): ProcessingJob {
  return {
    id: payload.id,
    status: payload.status,
    stage: payload.stage,
    progress: payload.progress,
    inputPath: payload.input_path,
    outputPath: payload.output_path,
    outputFormat: payload.output_format,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
    mediaType: payload.media_type,
    computeBackend: payload.compute_backend,
    error: payload.error,
  };
}

function isTauriRuntime() {
  return Boolean((globalThis as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

async function request(input: string, init?: RequestInit): Promise<Response> {
  await logClientEvent(
    "info",
    `request ${init?.method ?? "GET"} ${input}`
  );

  try {
    if (isTauriRuntime()) {
      const url = new URL(input);
      const responseText = await invoke<string>("engine_request", {
        method: init?.method ?? "GET",
        path: `${url.pathname}${url.search}`,
        body:
          typeof init?.body === "string"
            ? init.body
            : init?.body instanceof String
              ? init.body.toString()
              : undefined,
      });
      await logClientEvent(
        "info",
        `response 200 ${init?.method ?? "GET"} ${input}`
      );
      return new Response(responseText, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    const response = await fetch(input, init);
    await logClientEvent(
      "info",
      `response ${response.status} ${init?.method ?? "GET"} ${input}`
    );
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    await logClientEvent(
      "error",
      `request failed ${init?.method ?? "GET"} ${input}: ${message}`
    );
    throw error;
  }
}

export function createEngineClient(engineBaseUrl?: string) {
  const origin = baseUrl(engineBaseUrl);

  return {
    async bootstrap() {
      await logClientEvent("info", "invoke bootstrap_app");
      return invoke<BootstrapPayload>("bootstrap_app");
    },
    async health() {
      const response = await request(`${origin}/health`);
      return toEngineHealth(await readJson<EngineHealthWire>(response));
    },
    async setupStatus() {
      const response = await request(`${origin}/setup/status`);
      return toSetupStatus(await readJson<EngineSetupStatusWire>(response));
    },
    async downloadModel() {
      const response = await request(`${origin}/setup/model/download`, {
        method: "POST",
      });
      return readJson<DownloadModelResponse>(response);
    },
    async createJob(input: CreateJobInput) {
      const response = await request(`${origin}/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input_path: input.inputPath,
          output_dir: input.outputDir,
          output_format: input.outputFormat,
          compute_preference: input.computePreference,
        }),
      });
      return toCreateJobResponse(await readJson<CreateJobResponseWire>(response));
    },
    async job(jobId: string) {
      const response = await request(`${origin}/jobs/${jobId}`);
      return toProcessingJob(await readJson<ProcessingJobWire>(response));
    },
    async cancelJob(jobId: string) {
      const response = await request(`${origin}/jobs/${jobId}/cancel`, {
        method: "POST",
      });
      return toProcessingJob(await readJson<ProcessingJobWire>(response));
    },
  };
}
