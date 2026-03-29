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

const nextSteps = [
  ["1", "Choose a file", "Pick the audio or video file you want to clean up."],
  ["2", "Choose where to save it", "Pick the folder where the cleaned file should go."],
  ["3", "Start cleanup", "The app cleans the audio on this device."],
  ["4", "Open the result", "When it finishes, open the saved file from the Jobs page."],
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
    ["SETUP READY", setupStatus.modelReady ? "YES" : "NOT YET"],
    ["CLEANUP MODE", currentBackend.toUpperCase()],
    ["SAVE FORMAT", outputFormat.toUpperCase()],
    ["CURRENT JOB", activeJob ? activeJob.status.toUpperCase() : "NONE"],
    ["SELECTED FILE", inputPath ? pathTail(inputPath).toUpperCase() : "NONE"],
  ];
  const operationLog = [
    ["SELECTED FILE", inputPath ? pathTail(inputPath) : "No file selected yet"],
    [
      "APP SETUP",
      setupStatus.modelReady
        ? setupStatus.modelVersion ?? "Ready to use"
        : "Needs one-time setup",
    ],
    [
      "CURRENT STEP",
      activeJob ? activeJob.stage.replace(/-/g, " ") : "Waiting for you to start",
    ],
    ["SAVE FORMAT", outputFormat.toUpperCase()],
  ];

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
                <h3 className="noise-panel-title">
                  SOUND PREVIEW
                </h3>
                <p className="noise-panel-subtitle">
                  A simple visual preview of the audio shape.
                </p>
              </div>
              <span className="noise-kicker">PREVIEW</span>
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

            <div className="noise-meta-row noise-meta-row--stack">
              <div className="noise-meta-item">
                <span>LEVEL</span>
                <span>MEDIUM</span>
              </div>
              <div className="noise-meta-item">
                <span>DETAIL</span>
                <span>CLEAR</span>
              </div>
              <div className="noise-meta-item">
                <span>NOISE</span>
                <span>{setupStatus.modelReady ? "LOW" : "SETUP NEEDED"}</span>
              </div>
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
                <h3 className="noise-panel-title">CURRENT DETAILS</h3>
                <p className="noise-panel-subtitle">
                  Helpful details about the file you selected and the current app state.
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
