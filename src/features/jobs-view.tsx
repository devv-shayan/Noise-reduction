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
  ["WAITING", "The app has your request and is about to start."],
  ["GETTING READY", "The app is preparing the file and workspace."],
  ["READING FILE", "The audio is being read from the source file."],
  ["CLEANING AUDIO", "The cleanup model is improving the sound."],
  ["SAVING FILE", "The cleaned result is being saved."],
  ["DONE OR ISSUE", "The file is finished or needs your attention."],
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
      return "DONE";
    case "failed":
      return "ISSUE";
    case "cancelled":
      return "STOPPED";
    case "running":
      return "RUNNING";
    default:
      return "WAITING";
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
              Start a cleanup from the Process page and your saved jobs will
              appear here.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            You will be able to review progress, saved files, and any problems
            in one place.
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
            <p className="noise-kicker">RECENT CLEANUPS</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Your cleanup history
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Each cleanup shows its progress, save location, and whether it
              finished successfully.
            </p>
          </div>

          <div className="noise-meta-row">
            <div className="noise-meta-item">
              <span>TOTAL</span>
              <span>{jobs.length}</span>
            </div>
            <div className="noise-meta-item">
              <span>IN PROGRESS</span>
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
              <span>FILE</span>
              <span>STATE</span>
              <span>STEP</span>
              <span>MODE</span>
              <span>UPDATED</span>
            </div>

            {jobs.map((job) => (
              <div className="noise-table__entry" key={job.id}>
                <div className="noise-table__row">
                  <div className="noise-table__primary min-w-0">
                    <p className="truncate font-medium uppercase">
                      {pathTail(job.inputPath)}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {job.inputPath}
                    </p>
                  </div>
                  <div className="noise-table__field" data-label="State">
                    <span>{statusCode(job)}</span>
                  </div>
                  <div className="noise-table__field" data-label="Step">
                    <span>{formatStage(job.stage)}</span>
                  </div>
                  <div className="noise-table__field" data-label="Mode">
                    <span>{job.computeBackend?.toUpperCase() ?? "PENDING"}</span>
                  </div>
                  <div className="noise-table__field" data-label="Updated">
                    <span>{formatTimestamp(job.updatedAt)}</span>
                  </div>
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
                        <span>SAVED FILE</span>
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
              <h3 className="noise-panel-title">CURRENT JOB</h3>
              <p className="noise-panel-subtitle">
                A simple summary of the most recent cleanup.
              </p>
            </div>

            {latestJob ? (
              <div className="noise-panel-block">
                <div className="noise-list">
                  <div className="noise-list__row">
                    <span>FILE</span>
                    <span>{pathTail(latestJob.inputPath).toUpperCase()}</span>
                  </div>
                  <div className="noise-list__row">
                    <span>STATE</span>
                    <span>{statusCode(latestJob)}</span>
                  </div>
                  <div className="noise-list__row">
                    <span>STEP</span>
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
