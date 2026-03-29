export type NavigationView = "process" | "jobs" | "settings";
export type ComputePreference = "auto" | "cpu" | "gpu";
export type OutputFormat = "wav" | "flac";
export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";
export type MediaType = "audio" | "video";

export type AppSettings = {
  version: 1;
  theme: "light" | "dark" | "system";
  computePreference: ComputePreference;
  defaultOutputFormat: OutputFormat;
  autoCheckUpdates: boolean;
};

export type BootstrapPayload = {
  appVersion: string;
  engineBaseUrl: string;
  platform: string;
  updaterAvailable: boolean;
  paths: {
    appConfigDir: string;
    cacheDir: string;
    logDir: string;
    modelDir: string;
    resourcesDir: string | null;
    documentsDir: string | null;
  };
};

export type EngineHealth = {
  status: "ok" | "offline";
  version: string;
  modelReady: boolean;
};

export type EngineSetupStatus = {
  modelReady: boolean;
  modelVersion: string | null;
  computeBackends: string[];
  cachePath: string;
  downloadRequired: boolean;
  loading: boolean;
  activeBackend: string | null;
  lastError: string | null;
};

export type ProcessingJob = {
  id: string;
  status: JobStatus;
  stage: string;
  progress: number;
  inputPath: string;
  outputPath: string | null;
  outputFormat: OutputFormat;
  createdAt: string;
  updatedAt: string;
  mediaType: MediaType;
  computeBackend: string | null;
  error: string | null;
};

export type WaveformPreview = {
  points: number[];
  durationSeconds: number;
  peakLevel: number;
};

export type WaveformComparison = {
  before: WaveformPreview;
  after: WaveformPreview | null;
};

export type CreateJobInput = {
  inputPath: string;
  outputDir: string;
  outputFormat: OutputFormat;
  computePreference: ComputePreference;
};

export type CreateJobResponse = {
  jobId: string;
};

export type DownloadModelResponse = {
  status: "started" | "ready";
};
