import FileAudioIcon from "lucide-react/dist/esm/icons/file-audio.js";
import FolderOpenIcon from "lucide-react/dist/esm/icons/folder-open.js";
import HardDriveDownloadIcon from "lucide-react/dist/esm/icons/hard-drive-download.js";
import WandSparklesIcon from "lucide-react/dist/esm/icons/wand-sparkles.js";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type {
  AppSettings,
  EngineSetupStatus,
  OutputFormat,
  ProcessingJob,
} from "@/lib/types";

type ProcessViewProps = {
  activeJob: ProcessingJob | null;
  inputPath: string;
  onDownloadModel: () => Promise<void>;
  onOutputFormatChange: (format: OutputFormat) => void;
  onPickInput: () => Promise<void>;
  onPickOutputDirectory: () => Promise<void>;
  onStartProcessing: () => Promise<void>;
  outputDirectory: string;
  outputFormat: OutputFormat;
  setInputPath: (value: string) => void;
  setOutputDirectory: (value: string) => void;
  setupStatus: EngineSetupStatus;
  settings: AppSettings;
};

const signalTrace =
  "0,72 32,68 54,102 82,54 110,84 146,64 174,94 206,50 234,110 264,70 296,88 330,78 362,68 394,84 430,76 470,80 508,82 542,70 576,96 610,60 640,90";

const densityMatrix = [
  0, 1, 3, 2, 0, 1, 1, 2, 3, 0,
  1, 2, 0, 3, 3, 2, 0, 1, 2, 1,
  2, 3, 3, 0, 1, 1, 2, 3, 0, 2,
  0, 1, 2, 0, 0, 3, 1, 2, 1, 3,
  3, 2, 1, 0, 2, 0, 3, 1, 0, 1,
];

function pathTail(path: string) {
  return path.split(/[/\\]/).pop() || path;
}

export function ProcessView({
  activeJob,
  inputPath,
  onDownloadModel,
  onOutputFormatChange,
  onPickInput,
  onPickOutputDirectory,
  onStartProcessing,
  outputDirectory,
  outputFormat,
  setInputPath,
  setOutputDirectory,
  setupStatus,
  settings,
}: ProcessViewProps) {
  const canProcess = Boolean(
    inputPath && outputDirectory && setupStatus.modelReady && !setupStatus.loading
  );
  const currentBackend =
    setupStatus.activeBackend ?? settings.computePreference ?? "auto";
  const runtimeRows = [
    ["MODEL", setupStatus.modelReady ? "READY" : "PENDING"],
    ["BACKEND", currentBackend.toUpperCase()],
    ["EXPORT", outputFormat.toUpperCase()],
    ["QUEUE", activeJob ? activeJob.status.toUpperCase() : "IDLE"],
    ["SOURCE", inputPath ? pathTail(inputPath).toUpperCase() : "WAITING"],
  ];
  const operationLog = [
    ["SRC_PATH", inputPath ? pathTail(inputPath) : "Awaiting source media"],
    [
      "CACHE_STATE",
      setupStatus.modelReady
        ? setupStatus.modelVersion ?? "Model ready"
        : "Weights not cached",
    ],
    [
      "ACTIVE_JOB",
      activeJob ? activeJob.stage.replace(/-/g, " ") : "No worker claimed",
    ],
    ["OUTPUT_FMT", outputFormat.toUpperCase()],
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_380px]">
      <section className="noise-panel px-6 py-6 md:px-8 md:py-7" data-motion="rise">
        <div className="flex flex-col gap-6">
          <div>
            <p className="noise-kicker">PROCESS CONSOLE // INPUT ROUTING</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Source file and export destination
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Load one media file, point the export to a local folder, and run
              the cleanup chain through the desktop engine.
            </p>
          </div>

          {!setupStatus.modelReady ? (
            <Alert>
              <WandSparklesIcon />
              <AlertTitle>Model setup required</AlertTitle>
              <AlertDescription className="flex flex-col gap-3">
                <span>
                  The first run downloads LavaSR into the local cache so later
                  runs can stay offline.
                </span>
                <div>
                  <Button onClick={() => void onDownloadModel()} size="sm">
                    <HardDriveDownloadIcon data-icon="inline-start" />
                    Download model
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          {setupStatus.loading ? (
            <div className="noise-panel-block">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium uppercase tracking-[0.14em]">
                    Preparing local cache
                  </span>
                  <span className="text-muted-foreground">Background task</span>
                </div>
                <Progress value={45} />
                <p className="text-sm text-muted-foreground">
                  This usually happens once per machine. The workspace will stay
                  ready after the cache is complete.
                </p>
              </div>
            </div>
          ) : null}

          {setupStatus.lastError ? (
            <Alert variant="destructive">
              <WandSparklesIcon />
              <AlertTitle>Model setup reported an error</AlertTitle>
              <AlertDescription>{setupStatus.lastError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-6 border-t border-dotted border-border pt-6 xl:grid-cols-[minmax(0,1fr)_280px]">
            <FieldGroup className="gap-6">
              <Field>
                <FieldContent>
                  <FieldLabel htmlFor="input-path">Input media</FieldLabel>
                  <FieldDescription>
                    Accepts WAV, MP3, M4A, FLAC, MP4, MOV, MKV, and AVI.
                  </FieldDescription>
                </FieldContent>
                <InputGroup>
                  <InputGroupInput
                    id="input-path"
                    onChange={(event) => setInputPath(event.target.value)}
                    placeholder="Select source media"
                    value={inputPath}
                  />
                  <InputGroupAddon align="inline-end">
                    <Button onClick={() => void onPickInput()} size="icon-sm" variant="ghost">
                      <FileAudioIcon />
                    </Button>
                  </InputGroupAddon>
                </InputGroup>
              </Field>

              <Field>
                <FieldContent>
                  <FieldLabel htmlFor="output-directory">Output folder</FieldLabel>
                  <FieldDescription>
                    The cleaned audio file is written here after processing.
                  </FieldDescription>
                </FieldContent>
                <InputGroup>
                  <InputGroupInput
                    id="output-directory"
                    onChange={(event) => setOutputDirectory(event.target.value)}
                    placeholder="Select export directory"
                    value={outputDirectory}
                  />
                  <InputGroupAddon align="inline-end">
                    <Button
                      onClick={() => void onPickOutputDirectory()}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <FolderOpenIcon />
                    </Button>
                  </InputGroupAddon>
                </InputGroup>
              </Field>

              <Field orientation="responsive">
                <FieldContent>
                  <FieldTitle>Export format</FieldTitle>
                  <FieldDescription>
                    WAV is the safest default. FLAC keeps the export lossless
                    with smaller file size.
                  </FieldDescription>
                </FieldContent>
                <Select
                  onValueChange={(value) =>
                    onOutputFormatChange(value as OutputFormat)
                  }
                  value={outputFormat}
                >
                  <SelectTrigger className="w-full md:max-w-48">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="wav">WAV</SelectItem>
                      <SelectItem value="flac">FLAC</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>

            <div className="noise-panel-block flex flex-col gap-5">
              <div>
                <p className="noise-kicker">RESOURCE MATRIX</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Active runtime values reported by the local engine.
                </p>
              </div>

              <div className="noise-list">
                {runtimeRows.map(([label, value]) => (
                  <div className="noise-list__row" key={label}>
                    <span>{label}</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>

              <Button
                disabled={!canProcess || Boolean(activeJob)}
                onClick={() => void onStartProcessing()}
              >
                {activeJob ? "JOB ALREADY RUNNING" : "START CLEANUP"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-6">
        <section
          className="noise-panel px-5 py-5 md:px-6 md:py-6"
          data-motion="rise"
          data-motion-delay="1"
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="noise-panel-title">
                  SIGNAL TOPOLOGY // FREQUENCY OUTPUT
                </h3>
                <p className="noise-panel-subtitle">
                  Static trace reference for the current cleanup chain.
                </p>
              </div>
              <span className="noise-kicker">HZ/MS</span>
            </div>

            <div className="noise-signal-frame">
              <svg
                aria-hidden="true"
                className="noise-signal-svg"
                preserveAspectRatio="none"
                viewBox="0 0 640 180"
              >
                <line x1="0" x2="640" y1="40" y2="40" />
                <line x1="0" x2="640" y1="90" y2="90" />
                <line x1="0" x2="640" y1="140" y2="140" />
                <polyline points={signalTrace} />
              </svg>
            </div>

            <div className="noise-meta-row grid-cols-3">
              <div className="noise-meta-item">
                <span>AMP</span>
                <span>1.2V</span>
              </div>
              <div className="noise-meta-item">
                <span>FREQ</span>
                <span>2.4GHZ</span>
              </div>
              <div className="noise-meta-item">
                <span>NOISE</span>
                <span>{setupStatus.modelReady ? "LOW" : "PENDING"}</span>
              </div>
            </div>
          </div>
        </section>

        <section
          className="noise-panel px-5 py-5 md:px-6 md:py-6"
          data-motion="rise"
          data-motion-delay="2"
        >
          <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="noise-panel-title">NODE SECTOR DENSITY</h3>
                <p className="noise-panel-subtitle">
                  Synthetic grid used as a visual density readout.
                </p>
              </div>
              <div className="noise-matrix" aria-hidden="true">
                {densityMatrix.map((tone, index) => (
                  <span data-tone={tone} key={index} />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <h3 className="noise-panel-title">SYSTEM EVENT LOG</h3>
                <p className="noise-panel-subtitle">
                  Current source, cache, and queue values for the active run.
                </p>
              </div>
              <div className="noise-log-list">
                {operationLog.map(([label, value], index) => (
                  <div className="noise-log-row" key={label}>
                    <span>{`14:02:${54 - index * 3}`}</span>
                    <span>{label}</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
