import { startTransition, useEffect, useState } from "react";

import AlertCircleIcon from "lucide-react/dist/esm/icons/alert-circle.js";
import CpuIcon from "lucide-react/dist/esm/icons/cpu.js";
import SparklesIcon from "lucide-react/dist/esm/icons/sparkles.js";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/features/app-sidebar";
import { JobsView } from "@/features/jobs-view";
import { ProcessView } from "@/features/process-view";
import { SettingsView } from "@/features/settings-view";
import { createEngineClient } from "@/lib/engine-client";
import {
  checkForUpdates,
  installUpdate,
  pickInputPath,
  pickOutputDirectory,
  revealOutput,
} from "@/lib/native";
import { loadSettings, saveSettings } from "@/lib/settings";
import type {
  AppSettings,
  BootstrapPayload,
  EngineHealth,
  EngineSetupStatus,
  NavigationView,
  OutputFormat,
  ProcessingJob,
} from "@/lib/types";
import { toast } from "sonner";

const emptyHealth: EngineHealth = {
  status: "offline",
  version: "0.0.0",
  modelReady: false,
};

const emptySetupStatus: EngineSetupStatus = {
  modelReady: false,
  modelVersion: null,
  computeBackends: [],
  cachePath: "",
  downloadRequired: true,
  loading: false,
  activeBackend: null,
  lastError: null,
};

const utcTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

function mergeJobState(previous: ProcessingJob[], next: ProcessingJob) {
  const remaining = previous.filter((job) => job.id !== next.id);
  return [next, ...remaining].sort(
    (left, right) =>
      Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  );
}

function delay(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function normalizeSetupStatus(setupStatus: EngineSetupStatus) {
  return {
    ...setupStatus,
    computeBackends: setupStatus.computeBackends.map((backend) =>
      backend.toLowerCase()
    ),
    activeBackend: setupStatus.activeBackend?.toLowerCase() ?? null,
  };
}

export default function App() {
  const [currentView, setCurrentView] = useState<NavigationView>("process");
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [health, setHealth] = useState<EngineHealth>(emptyHealth);
  const [setupStatus, setSetupStatus] =
    useState<EngineSetupStatus>(emptySetupStatus);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [inputPath, setInputPath] = useState("");
  const [outputDirectory, setOutputDirectory] = useState("");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>(
    settings.defaultOutputFormat
  );
  const [clock, setClock] = useState(() => new Date());

  const activeJob =
    jobs.find((job) => job.status === "running" || job.status === "queued") ??
    null;
  const completedJobs = jobs.filter((job) => job.status === "completed").length;
  const failedJobs = jobs.filter((job) => job.status === "failed").length;
  const activeBackend = (
    setupStatus.activeBackend ?? settings.computePreference
  ).toUpperCase();
  const systemStatus = appError
    ? "Needs attention"
    : setupStatus.loading
      ? "Getting ready"
      : health.modelReady
        ? "Ready"
        : "Setup needed";
  const appVersion =
    bootstrap?.appVersion?.toUpperCase() ??
    (health.version === "0.0.0" ? "STARTING" : health.version.toUpperCase());
  const systemTime = `${utcTimeFormatter.format(clock)} UTC`;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClock(new Date());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    setHealth((previous) => ({
      ...previous,
      modelReady: setupStatus.modelReady,
    }));
  }, [setupStatus.modelReady]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapApplication() {
      setIsBootstrapping(true);
      setAppError(null);

      try {
        const engineClient = createEngineClient();
        const bootstrapPayload = await engineClient.bootstrap();
        const bootstrappedEngineClient = createEngineClient(
          bootstrapPayload.engineBaseUrl
        );

        let healthPayload: EngineHealth | null = null;
        let setupPayload: EngineSetupStatus | null = null;
        let lastError: unknown = null;

        for (let attempt = 0; attempt < 8; attempt += 1) {
          try {
            [healthPayload, setupPayload] = await Promise.all([
              bootstrappedEngineClient.health(),
              bootstrappedEngineClient.setupStatus(),
            ]);
            break;
          } catch (error) {
            lastError = error;
            await delay(750);
          }
        }

        if (!healthPayload || !setupPayload) {
          throw lastError instanceof Error
            ? lastError
            : new Error("Failed to bootstrap the desktop app.");
        }

        if (cancelled) {
          return;
        }

        setBootstrap(bootstrapPayload);
        setHealth(healthPayload);
        setSetupStatus(normalizeSetupStatus(setupPayload));

        if (!outputDirectory && bootstrapPayload.paths.documentsDir) {
          setOutputDirectory(bootstrapPayload.paths.documentsDir);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to bootstrap the desktop app.";
          setAppError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    }

    void bootstrapApplication();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bootstrap || !setupStatus.loading) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void createEngineClient(bootstrap.engineBaseUrl)
        .setupStatus()
        .then((nextSetupStatus) => {
          startTransition(() => {
            setSetupStatus(normalizeSetupStatus(nextSetupStatus));
          });
        })
        .catch((error) => {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to refresh model status.";
          toast.error(message);
        });
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [bootstrap, setupStatus.loading]);

  useEffect(() => {
    if (!bootstrap || !activeJob) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void createEngineClient(bootstrap.engineBaseUrl)
        .job(activeJob.id)
        .then((job) => {
          startTransition(() => {
            setJobs((previous) => mergeJobState(previous, job));
          });
        })
        .catch((error) => {
          const message =
            error instanceof Error ? error.message : "Failed to refresh job.";
          toast.error(message);
        });
    }, 1500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeJob, bootstrap]);

  async function handlePickInput() {
    const selectedPath = await pickInputPath();
    if (selectedPath) {
      setInputPath(selectedPath);
    }
  }

  async function handlePickOutputDirectory() {
    const selectedPath = await pickOutputDirectory();
    if (selectedPath) {
      setOutputDirectory(selectedPath);
    }
  }

  async function handleStartProcessing() {
    if (!inputPath || !outputDirectory) {
      toast.error("Choose an input file and an output folder first.");
      return;
    }

    try {
      const engineClient = createEngineClient(bootstrap?.engineBaseUrl);
      const createdJob = await engineClient.createJob({
        inputPath,
        outputDir: outputDirectory,
        outputFormat,
        computePreference: settings.computePreference,
      });
      const nextJob = await engineClient.job(createdJob.jobId);

      startTransition(() => {
        setJobs((previous) => mergeJobState(previous, nextJob));
        setCurrentView("jobs");
      });

      toast.success("Processing started.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start processing.";
      toast.error(message);
    }
  }

  async function handleDownloadModel() {
    try {
      const engineClient = createEngineClient(bootstrap?.engineBaseUrl);
      await engineClient.downloadModel();
      setSetupStatus((previous) => ({ ...previous, loading: true }));
      toast.success("Model setup started.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start model setup.";
      toast.error(message);
    }
  }

  async function handleCancelJob(jobId: string) {
    try {
      const engineClient = createEngineClient(bootstrap?.engineBaseUrl);
      const nextJob = await engineClient.cancelJob(jobId);
      startTransition(() => {
        setJobs((previous) => mergeJobState(previous, nextJob));
      });
      toast("Cancellation requested.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to cancel the job.";
      toast.error(message);
    }
  }

  async function handleRevealOutput(path: string) {
    try {
      await revealOutput(path);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to reveal the output file.";
      toast.error(message);
    }
  }

  async function handleCheckUpdates() {
    setIsCheckingUpdates(true);

    try {
      const update = await checkForUpdates();

      if (!update) {
        toast.success("You already have the latest version.");
        return;
      }

      toast("Update found. Downloading and relaunching.");
      await installUpdate(update);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to check updates.";
      toast.error(message);
    } finally {
      setIsCheckingUpdates(false);
    }
  }

  function handleSettingsChange(nextSettings: AppSettings) {
    setSettings(nextSettings);
    setOutputFormat(nextSettings.defaultOutputFormat);
  }

  return (
    <TooltipProvider delayDuration={150}>
      <SidebarProvider defaultOpen>
        <AppSidebar
          activeJob={activeJob}
          completedJobs={completedJobs}
          currentView={currentView}
          failedJobs={failedJobs}
          jobCount={jobs.length}
          onViewChange={setCurrentView}
          setupStatus={setupStatus}
        />
        <SidebarInset className="bg-transparent">
          <header className="sticky top-0 z-20 border-b border-border bg-background/96 px-4 py-4 backdrop-blur-sm md:px-6">
            <div className="noise-shell noise-header">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start">
                <SidebarTrigger className="mt-1 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                  <div className="noise-wordmark" aria-label="Noise Reduction">
                    NOISE REDUCTION
                  </div>
                  <p className="noise-wordmark__subtitle">
                    SIMPLE AUDIO CLEANUP APP
                  </p>
                </div>
                <Button
                  className="col-span-2 w-full sm:col-span-1 sm:w-auto"
                  disabled={isCheckingUpdates || !bootstrap?.updaterAvailable}
                  onClick={() => void handleCheckUpdates()}
                  size="sm"
                  variant="outline"
                >
                  {isCheckingUpdates ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <CpuIcon data-icon="inline-start" />
                  )}
                  Check updates
                </Button>
              </div>

              <div className="noise-meta-row mt-4">
                <div className="noise-meta-item">
                  <span>APP</span>
                  <span>DESKTOP CLEANUP</span>
                </div>
                <div className="noise-meta-item">
                  <span>STATUS</span>
                  <span>{systemStatus}</span>
                </div>
                <div className="noise-meta-item">
                  <span>JOBS</span>
                  <span>{jobs.length}</span>
                </div>
                <div className="noise-meta-item">
                  <span>CLEANUP</span>
                  <span>{activeBackend}</span>
                </div>
                <div className="noise-meta-item">
                  <span>VERSION</span>
                  <span>{appVersion}</span>
                </div>
                <div className="noise-meta-item">
                  <span>TIME</span>
                  <span>{systemTime}</span>
                </div>
              </div>
            </div>
          </header>

          <main className="noise-app-main">
            <div className="noise-shell flex flex-col gap-6">
              {appError ? (
                <Alert variant="destructive">
                  <AlertCircleIcon />
                  <AlertTitle>Desktop bootstrap failed</AlertTitle>
                  <AlertDescription>{appError}</AlertDescription>
                </Alert>
              ) : null}

              {isBootstrapping ? (
                <section
                  className="noise-panel flex min-h-[56svh] flex-col gap-8 px-6 py-7 md:px-8"
                  data-motion="rise"
                >
                  <div className="flex items-center gap-3 text-sm font-medium uppercase tracking-[0.18em]">
                    <Spinner />
                    Starting the app
                  </div>
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="flex flex-col gap-4">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-10 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-5/6" />
                      <Skeleton className="h-32 w-full" />
                    </div>
                    <div className="flex flex-col gap-4">
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="h-48 w-full" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                </section>
              ) : null}

              {!isBootstrapping && currentView === "process" ? (
                <ProcessView
                  activeJob={activeJob}
                  inputPath={inputPath}
                  onDownloadModel={handleDownloadModel}
                  onOutputFormatChange={setOutputFormat}
                  onPickInput={handlePickInput}
                  onPickOutputDirectory={handlePickOutputDirectory}
                  onStartProcessing={handleStartProcessing}
                  outputDirectory={outputDirectory}
                  outputFormat={outputFormat}
                  setInputPath={setInputPath}
                  setOutputDirectory={setOutputDirectory}
                  setupStatus={setupStatus}
                  settings={settings}
                />
              ) : null}

              {!isBootstrapping && currentView === "jobs" ? (
                <JobsView
                  jobs={jobs}
                  onCancelJob={handleCancelJob}
                  onRevealOutput={handleRevealOutput}
                />
              ) : null}

              {!isBootstrapping && currentView === "settings" ? (
                <SettingsView
                  bootstrap={bootstrap}
                  isCheckingUpdates={isCheckingUpdates}
                  onCheckUpdates={handleCheckUpdates}
                  onDownloadModel={handleDownloadModel}
                  onSettingsChange={handleSettingsChange}
                  settings={settings}
                  setupStatus={setupStatus}
                />
              ) : null}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
