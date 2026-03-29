import { startTransition, useEffect, useRef, useState } from "react";

import FileAudioIcon from "lucide-react/dist/esm/icons/file-audio.js";
import FolderOpenIcon from "lucide-react/dist/esm/icons/folder-open.js";
import HardDriveDownloadIcon from "lucide-react/dist/esm/icons/hard-drive-download.js";
import PlayIcon from "lucide-react/dist/esm/icons/play.js";
import WandSparklesIcon from "lucide-react/dist/esm/icons/wand-sparkles.js";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { createEngineClient } from "@/lib/engine-client";
import type {
  AppSettings,
  EngineSetupStatus,
  OutputFormat,
  ProcessingJob,
  WaveformComparison,
  WaveformPreview,
} from "@/lib/types";

type ProcessViewProps = {
  activeJob: ProcessingJob | null;
  comparisonOutputPath: string | null;
  engineBaseUrl?: string;
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

const nextSteps = [
  ["1", "Choose a file", "Pick the audio or video file you want to clean up."],
  ["2", "Choose where to save it", "Pick the folder where the cleaned file should go."],
  ["3", "Start cleanup", "The app cleans the audio on this device."],
  ["4", "Open the result", "When it finishes, open the saved file from the Jobs page."],
];

function pathTail(path: string) {
  return path.split(/[/\\]/).pop() || path;
}

function formatDuration(durationSeconds: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return "0s";
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.round(durationSeconds % 60);

  if (!minutes) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function formatClockTime(durationSeconds: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return "0:00";
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.floor(durationSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getWaveformErrorMessage(error: unknown) {
  const fallback = "Failed to generate the waveform preview.";
  const message = error instanceof Error ? error.message : String(error);

  if (
    (message.includes("/preview/waveform") &&
      message.toLowerCase().includes("not found")) ||
    message.includes('{"detail":"Not Found"}')
  ) {
    return "The app is still connected to an older background engine. Fully close the desktop app, make sure the old engine process stops, then open the app again.";
  }

  return fallback;
}

function waveformPolyline(points: number[]) {
  if (!points.length) {
    return "";
  }

  return points
    .map((point, index) => {
      const x = (index / (points.length - 1 || 1)) * 640;
      const y = 90 - Math.max(0, Math.min(1, point)) * 68;
      return `${x},${y}`;
    })
    .join(" ");
}

function focusRect(preview: WaveformPreview) {
  const x = (preview.focusStartSeconds / Math.max(preview.durationSeconds, 0.001)) * 640;
  const width =
    (preview.focusDurationSeconds / Math.max(preview.durationSeconds, 0.001)) * 640;

  return {
    x: Math.max(0, Math.min(640, x)),
    width: Math.max(18, Math.min(640 - x, width)),
  };
}

function WaveformPanel({
  emptyDescription,
  emptyTitle,
  isLoading,
  label,
  preview,
}: {
  emptyDescription: string;
  emptyTitle: string;
  isLoading: boolean;
  label: string;
  preview: WaveformPreview | null;
}) {
  return (
    <div className="noise-panel-block">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="noise-panel-title">{label}</h4>
          {isLoading ? (
            <span className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <Spinner />
              Loading
            </span>
          ) : null}
        </div>

        {preview ? (
          <>
            <div className="noise-signal-frame">
              <svg
                aria-label={`${label} waveform`}
                className="noise-signal-svg"
                preserveAspectRatio="none"
                role="img"
                viewBox="0 0 640 180"
              >
                <line x1="0" x2="640" y1="40" y2="40" />
                <line x1="0" x2="640" y1="90" y2="90" />
                <line x1="0" x2="640" y1="140" y2="140" />
                <rect
                  className="noise-waveform-focus"
                  height="180"
                  width={focusRect(preview).width}
                  x={focusRect(preview).x}
                  y="0"
                />
                <polyline points={waveformPolyline(preview.points)} />
              </svg>
            </div>

            <div className="noise-list">
              <div className="noise-list__row">
                <span>Length</span>
                <span>{formatDuration(preview.durationSeconds)}</span>
              </div>
              <div className="noise-list__row">
                <span>Best compare moment</span>
                <span>
                  {formatClockTime(preview.focusStartSeconds)} to{" "}
                  {formatClockTime(
                    preview.focusStartSeconds + preview.focusDurationSeconds
                  )}
                </span>
              </div>
            </div>
          </>
        ) : (
          <Empty className="border-0 bg-transparent px-0 py-3">
            <EmptyHeader>
              <EmptyTitle>{emptyTitle}</EmptyTitle>
              <EmptyDescription>{emptyDescription}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}

export function ProcessView({
  activeJob,
  comparisonOutputPath,
  engineBaseUrl,
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const compareQueueRef = useRef<Array<"before" | "after">>([]);

  const [waveforms, setWaveforms] = useState<WaveformComparison | null>(null);
  const [isWaveformLoading, setIsWaveformLoading] = useState(false);
  const [waveformError, setWaveformError] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<"before" | "after">("before");
  const [playerSource, setPlayerSource] = useState("");

  const canProcess = Boolean(
    inputPath && outputDirectory && setupStatus.modelReady && !setupStatus.loading
  );
  const currentBackend =
    setupStatus.activeBackend ?? settings.computePreference ?? "auto";
  const runtimeRows = [
    ["SETUP READY", setupStatus.modelReady ? "YES" : "NOT YET"],
    ["CLEANUP MODE", currentBackend.toUpperCase()],
    ["SAVE FORMAT", outputFormat.toUpperCase()],
    ["CURRENT JOB", activeJob ? activeJob.status.toUpperCase() : "NONE"],
    ["SELECTED FILE", inputPath ? pathTail(inputPath).toUpperCase() : "NONE"],
  ];
  const detailRows = waveforms?.improvement
    ? [
        [
          "NOISE CHANGE",
          `${waveforms.improvement.noiseReductionDb.toFixed(1)} dB`,
        ],
        [
          "LOUDNESS CHANGE",
          `${waveforms.improvement.loudnessChangeDb >= 0 ? "+" : ""}${waveforms.improvement.loudnessChangeDb.toFixed(1)} dB`,
        ],
        [
          "PEAK CHANGE",
          `${waveforms.improvement.peakChangePercent >= 0 ? "-" : "+"}${Math.abs(waveforms.improvement.peakChangePercent).toFixed(1)}%`,
        ],
        [
          "COMPARE MOMENT",
          `${formatClockTime(waveforms.improvement.focusStartSeconds)} to ${formatClockTime(
            waveforms.improvement.focusStartSeconds +
              waveforms.improvement.focusDurationSeconds
          )}`,
        ],
      ]
    : [
        ["SELECTED FILE", inputPath ? pathTail(inputPath) : "No file selected yet"],
        [
          "APP SETUP",
          setupStatus.modelReady
            ? setupStatus.modelVersion ?? "Ready to use"
            : "Needs one-time setup",
        ],
        [
          "CURRENT STEP",
          activeJob
            ? activeJob.stage.replace(/-/g, " ")
            : "Waiting for you to start",
        ],
        ["SAVE FORMAT", outputFormat.toUpperCase()],
      ];
  const selectedPreview =
    selectedClip === "after" && waveforms?.after
      ? waveforms.after
      : waveforms?.before ?? null;

  useEffect(() => {
    if (!inputPath) {
      setWaveforms(null);
      setWaveformError(null);
      setIsWaveformLoading(false);
      return;
    }

    let cancelled = false;
    setIsWaveformLoading(true);
    setWaveformError(null);

    void createEngineClient(engineBaseUrl)
      .waveformPreview(inputPath, comparisonOutputPath)
      .then((nextWaveforms) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setWaveforms(nextWaveforms);
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        const message = getWaveformErrorMessage(error);
        setWaveforms(null);
        setWaveformError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setIsWaveformLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [comparisonOutputPath, engineBaseUrl, inputPath]);

  useEffect(() => {
    if (selectedClip === "after" && !waveforms?.after) {
      setSelectedClip("before");
    }
  }, [selectedClip, waveforms?.after]);

  useEffect(() => {
    if (compareQueueRef.current.length > 0) {
      return;
    }

    setPlayerSource(selectedPreview?.clipDataUrl ?? "");
  }, [selectedPreview]);

  function previewFor(kind: "before" | "after") {
    if (kind === "after") {
      return waveforms?.after ?? null;
    }

    return waveforms?.before ?? null;
  }

  function playSequence(sequence: Array<"before" | "after">) {
    const available = sequence.filter((kind) => Boolean(previewFor(kind)));
    if (!available.length || !audioRef.current) {
      return;
    }

    const [first, ...rest] = available;
    const firstPreview = previewFor(first);
    if (!firstPreview) {
      return;
    }

    compareQueueRef.current = rest;
    setSelectedClip(first);
    setPlayerSource(firstPreview.clipDataUrl);
    audioRef.current.src = firstPreview.clipDataUrl;
    audioRef.current.currentTime = 0;
    void audioRef.current.play();
  }

  function handleAudioEnded() {
    const next = compareQueueRef.current.shift();
    if (!next || !audioRef.current) {
      compareQueueRef.current = [];
      return;
    }

    const preview = previewFor(next);
    if (!preview) {
      compareQueueRef.current = [];
      return;
    }

    setSelectedClip(next);
    setPlayerSource(preview.clipDataUrl);
    audioRef.current.src = preview.clipDataUrl;
    audioRef.current.currentTime = 0;
    void audioRef.current.play();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_380px]">
      <section className="noise-panel px-6 py-6 md:px-8 md:py-7" data-motion="rise">
        <div className="flex flex-col gap-6">
          <div>
            <p className="noise-kicker">START CLEANUP</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Choose a file and where to save it
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Pick one file, choose a save folder, and let the app clean up the
              audio for you.
            </p>
          </div>

          {!setupStatus.modelReady ? (
            <Alert>
              <WandSparklesIcon />
              <AlertTitle>One quick setup step</AlertTitle>
              <AlertDescription className="flex flex-col gap-3">
                <span>
                  The app needs to download its cleanup model once. After that,
                  it works locally on this device.
                </span>
                <div>
                  <Button onClick={() => void onDownloadModel()} size="sm">
                    <HardDriveDownloadIcon data-icon="inline-start" />
                    Download setup files
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
                    Getting things ready
                  </span>
                  <span className="text-muted-foreground">One-time setup</span>
                </div>
                <Progress value={45} />
                <p className="text-sm text-muted-foreground">
                  This usually happens once. The app will be ready to use after
                  the download finishes.
                </p>
              </div>
            </div>
          ) : null}

          {setupStatus.lastError ? (
            <Alert variant="destructive">
              <WandSparklesIcon />
              <AlertTitle>Setup needs attention</AlertTitle>
              <AlertDescription>{setupStatus.lastError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-6 border-t border-dotted border-border pt-6 xl:grid-cols-[minmax(0,1fr)_280px]">
            <FieldGroup className="gap-6">
              <Field>
                <FieldContent>
                  <FieldLabel htmlFor="input-path">File to clean</FieldLabel>
                  <FieldDescription>
                    You can choose common audio and video file types.
                  </FieldDescription>
                </FieldContent>
                <InputGroup>
                  <InputGroupInput
                    id="input-path"
                    onChange={(event) => setInputPath(event.target.value)}
                    placeholder="Choose a file"
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
                  <FieldLabel htmlFor="output-directory">Save cleaned file to</FieldLabel>
                  <FieldDescription>
                    Pick the folder where the cleaned file should be saved.
                  </FieldDescription>
                </FieldContent>
                <InputGroup>
                  <InputGroupInput
                    id="output-directory"
                    onChange={(event) => setOutputDirectory(event.target.value)}
                    placeholder="Choose a folder"
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
                    WAV is the simplest choice. FLAC keeps the same quality with
                    smaller files.
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
                <p className="noise-kicker">READY TO CLEAN</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  A quick summary before you start.
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
                {activeJob ? "CLEANUP IN PROGRESS" : "START CLEANUP"}
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
                <h3 className="noise-panel-title">BEFORE AND AFTER PREVIEW</h3>
                <p className="noise-panel-subtitle">
                  Listen to the same short moment before and after cleanup.
                </p>
              </div>
              <span className="noise-kicker">
                {isWaveformLoading ? "LOADING" : "LIVE"}
              </span>
            </div>

            {waveformError ? (
              <Alert variant="destructive">
                <WandSparklesIcon />
                <AlertTitle>Preview needs attention</AlertTitle>
                <AlertDescription>{waveformError}</AlertDescription>
              </Alert>
            ) : null}

            {waveforms?.improvement ? (
              <div className="noise-result-summary">
                <div>
                  <p className="noise-kicker">CLEANUP RESULT</p>
                  <h4 className="noise-result-summary__verdict">
                    {waveforms.improvement.verdict}
                  </h4>
                </div>

                <div className="noise-result-summary__metrics">
                  <div className="noise-stat">
                    <span className="noise-stat__label">Noise change</span>
                    <span className="noise-stat__value">
                      {waveforms.improvement.noiseReductionDb.toFixed(1)} dB
                    </span>
                  </div>
                  <div className="noise-stat">
                    <span className="noise-stat__label">Volume change</span>
                    <span className="noise-stat__value">
                      {waveforms.improvement.loudnessChangeDb >= 0 ? "+" : ""}
                      {waveforms.improvement.loudnessChangeDb.toFixed(1)} dB
                    </span>
                  </div>
                </div>

                <div className="noise-result-summary__list">
                  {waveforms.improvement.summary.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </div>
            ) : (
              <div className="noise-panel-block">
                <p className="noise-kicker">CLEANUP RESULT</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Run cleanup once to see a plain-language summary of how much the audio changed.
                </p>
              </div>
            )}

            <div className="noise-panel-block">
              <div className="flex flex-col gap-4">
                <div>
                  <h4 className="noise-panel-title">LISTEN TO THE DIFFERENCE</h4>
                  <p className="noise-panel-subtitle">
                    These short clips use the same moment and matched playback volume so the difference is easier to hear.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <ToggleGroup
                    className="w-full justify-start"
                    onValueChange={(value) => {
                      if (!value) {
                        return;
                      }

                      compareQueueRef.current = [];
                      setSelectedClip(value as "before" | "after");
                    }}
                    type="single"
                    value={selectedClip}
                  >
                    <ToggleGroupItem value="before">Before</ToggleGroupItem>
                    <ToggleGroupItem disabled={!waveforms?.after} value="after">
                      After
                    </ToggleGroupItem>
                  </ToggleGroup>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => playSequence(["before"])}
                      size="sm"
                      variant="outline"
                    >
                      <PlayIcon data-icon="inline-start" />
                      Play before
                    </Button>
                    <Button
                      disabled={!waveforms?.after}
                      onClick={() => playSequence(["after"])}
                      size="sm"
                      variant="outline"
                    >
                      <PlayIcon data-icon="inline-start" />
                      Play after
                    </Button>
                    <Button
                      disabled={!waveforms?.after}
                      onClick={() => playSequence(["before", "after"])}
                      size="sm"
                    >
                      <PlayIcon data-icon="inline-start" />
                      Compare
                    </Button>
                  </div>
                </div>

                {waveforms?.before ? (
                  <p className="text-sm text-muted-foreground">
                    Best comparison moment:{" "}
                    <span className="font-medium text-foreground">
                      {formatClockTime(waveforms.before.focusStartSeconds)} to{" "}
                      {formatClockTime(
                        waveforms.before.focusStartSeconds +
                          waveforms.before.focusDurationSeconds
                      )}
                    </span>
                  </p>
                ) : null}

                {selectedPreview ? (
                  <audio
                    key={playerSource}
                    className="noise-audio-player"
                    controls
                    onEnded={handleAudioEnded}
                    ref={audioRef}
                    src={playerSource}
                  />
                ) : (
                  <Empty className="border-0 bg-transparent px-0 py-0">
                    <EmptyHeader>
                      <EmptyTitle>No compare clip yet</EmptyTitle>
                      <EmptyDescription>
                        Choose a file first. After cleanup finishes, you can compare the same moment before and after.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <WaveformPanel
                emptyDescription="Choose a file to generate the original waveform."
                emptyTitle="No file selected"
                isLoading={isWaveformLoading && Boolean(inputPath)}
                label="Before cleanup"
                preview={waveforms?.before ?? null}
              />
              <WaveformPanel
                emptyDescription="Run cleanup once and the cleaned waveform will appear here."
                emptyTitle="No cleaned result yet"
                isLoading={isWaveformLoading && Boolean(comparisonOutputPath)}
                label="After cleanup"
                preview={waveforms?.after ?? null}
              />
            </div>
          </div>
        </section>

        <section
          className="noise-panel px-5 py-5 md:px-6 md:py-6"
          data-motion="rise"
          data-motion-delay="2"
        >
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-1">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="noise-panel-title">WHAT HAPPENS NEXT</h3>
                <p className="noise-panel-subtitle">
                  The app follows these steps after you press start.
                </p>
              </div>
              <div className="noise-log-list">
                {nextSteps.map(([step, title, description]) => (
                  <div className="noise-log-row" key={step}>
                    <span>{step}</span>
                    <span>{title}</span>
                    <span>{description}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <h3 className="noise-panel-title">TECHNICAL DETAILS</h3>
                <p className="noise-panel-subtitle">
                  Extra information for checking the cleanup result.
                </p>
              </div>
              <div className="noise-log-list">
                {detailRows.map(([label, value], index) => (
                  <div className="noise-log-row" key={label}>
                    <span>{`#0${index + 1}`}</span>
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
