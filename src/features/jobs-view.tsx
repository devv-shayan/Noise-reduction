import ClockIcon from "lucide-react/dist/esm/icons/clock.js";
import FolderOpenIcon from "lucide-react/dist/esm/icons/folder-open.js";
import SquareXIcon from "lucide-react/dist/esm/icons/square-x.js";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import type { ProcessingJob } from "@/lib/types";

type JobsViewProps = {
  jobs: ProcessingJob[];
  onCancelJob: (jobId: string) => Promise<void>;
  onRevealOutput: (path: string) => Promise<void>;
};

const stageDescriptions = [
  ["QUEUED", "Accepted by the engine and waiting for a worker."],
  ["PREPARING", "Validating paths and preparing temporary files."],
  ["EXTRACTING", "Extracting or decoding source audio when needed."],
  ["RUNNING", "Enhancing the signal with LavaSR."],
  ["ENCODING", "Writing the cleaned result to the selected format."],
  ["FINAL", "Persisting the final path or an error summary."],
];

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatStage(stage: string) {
  return stage.replace(/-/g, " ").toUpperCase();
}

function formatTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "UNKNOWN";
  }

  return dateFormatter.format(parsed).toUpperCase();
}

function pathTail(path: string) {
  return path.split(/[/\\]/).pop() || path;
}

function statusCode(job: ProcessingJob) {
  switch (job.status) {
    case "completed":
      return "OK";
    case "failed":
      return "ERR";
    case "cancelled":
      return "STOP";
    case "running":
      return "RUN";
    default:
      return "QUE";
  }
}

export function JobsView({
  jobs,
  onCancelJob,
  onRevealOutput,
}: JobsViewProps) {
  if (!jobs.length) {
    return (
      <section className="noise-panel px-6 py-8 md:px-8" data-motion="rise">
        <Empty className="border-0 bg-transparent">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClockIcon />
            </EmptyMedia>
            <EmptyTitle>No jobs yet</EmptyTitle>
            <EmptyDescription>
              Start a processing run from the Process view and the queue ledger
              will appear here.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            Output paths, errors, and cancellation state are all persisted in
            this log.
          </EmptyContent>
        </Empty>
      </section>
    );
  }

  const activeJobs = jobs.filter(
    (job) => job.status === "queued" || job.status === "running"
  ).length;
  const completedJobs = jobs.filter((job) => job.status === "completed").length;
  const failedJobs = jobs.filter((job) => job.status === "failed").length;
  const latestJob = jobs[0] ?? null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="noise-panel px-6 py-6 md:px-8 md:py-7" data-motion="rise">
        <div className="flex flex-col gap-6">
          <div>
            <p className="noise-kicker">JOB LEDGER // OUTPUT HISTORY</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Queue activity and export trace
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Each run is logged with its state, worker stage, backend, progress,
              and final export path.
            </p>
          </div>

          <div className="noise-meta-row">
            <div className="noise-meta-item">
              <span>TRACKED</span>
              <span>{jobs.length}</span>
            </div>
            <div className="noise-meta-item">
              <span>ACTIVE</span>
              <span>{activeJobs}</span>
            </div>
            <div className="noise-meta-item">
              <span>DONE</span>
              <span>{completedJobs}</span>
            </div>
            <div className="noise-meta-item">
              <span>FAILED</span>
              <span>{failedJobs}</span>
            </div>
          </div>

          <div className="noise-table">
            <div className="noise-table__head">
              <span>SOURCE</span>
              <span>STATE</span>
              <span>STAGE</span>
              <span>BACKEND</span>
              <span>UPDATED</span>
            </div>

            {jobs.map((job) => (
              <div className="noise-table__entry" key={job.id}>
                <div className="noise-table__row">
                  <div className="min-w-0">
                    <p className="truncate font-medium uppercase">
                      {pathTail(job.inputPath)}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {job.inputPath}
                    </p>
                  </div>
                  <span>{statusCode(job)}</span>
                  <span>{formatStage(job.stage)}</span>
                  <span>{job.computeBackend?.toUpperCase() ?? "PENDING"}</span>
                  <span>{formatTimestamp(job.updatedAt)}</span>
                </div>

                <div className="noise-table__detail">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      <span>{job.outputFormat.toUpperCase()}</span>
                      <span>{job.progress}%</span>
                    </div>
                    <Progress value={job.progress} />
                    {job.outputPath ? (
                      <div className="noise-list__row">
                        <span>OUTPUT</span>
                        <span className="truncate">{job.outputPath}</span>
                      </div>
                    ) : null}
                    {job.error ? (
                      <div className="noise-list__row">
                        <span>ERROR</span>
                        <span className="truncate">{job.error}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {job.outputPath ? (
                      <Button
                        onClick={() => void onRevealOutput(job.outputPath!)}
                        size="sm"
                        variant="outline"
                      >
                        <FolderOpenIcon data-icon="inline-start" />
                        Reveal output
                      </Button>
                    ) : null}
                    {job.status === "running" || job.status === "queued" ? (
                      <Button
                        onClick={() => void onCancelJob(job.id)}
                        size="sm"
                        variant="outline"
                      >
                        <SquareXIcon data-icon="inline-start" />
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-6">
        <section
          className="noise-panel px-5 py-5 md:px-6 md:py-6"
          data-motion="rise"
          data-motion-delay="1"
        >
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="noise-panel-title">LATEST QUEUE SNAPSHOT</h3>
              <p className="noise-panel-subtitle">
                Most recent job state and progress readout.
              </p>
            </div>

            {latestJob ? (
              <div className="noise-panel-block">
                <div className="noise-list">
                  <div className="noise-list__row">
                    <span>SOURCE</span>
                    <span>{pathTail(latestJob.inputPath).toUpperCase()}</span>
                  </div>
                  <div className="noise-list__row">
                    <span>STATE</span>
                    <span>{statusCode(latestJob)}</span>
                  </div>
                  <div className="noise-list__row">
                    <span>STAGE</span>
                    <span>{formatStage(latestJob.stage)}</span>
                  </div>
                  <div className="noise-list__row">
                    <span>FORMAT</span>
                    <span>{latestJob.outputFormat.toUpperCase()}</span>
                  </div>
                  <div className="noise-list__row">
                    <span>UPDATED</span>
                    <span>{formatTimestamp(latestJob.updatedAt)}</span>
                  </div>
                </div>
                <div className="mt-4">
                  <Progress value={latestJob.progress} />
                </div>
              </div>
            ) : null}

            <Separator />

            <div className="noise-log-list">
              {stageDescriptions.map(([stage, description], index) => (
                <div className="noise-log-row" key={stage}>
                  <span>{`#0${index + 1}`}</span>
                  <span>{stage}</span>
                  <span>{description}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
