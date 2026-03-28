import { useState } from "react";
import { ProcessForm } from "./components/ProcessForm";
import { StatusPanel } from "./components/StatusPanel";
import { processAudio } from "./lib/api";

type ViewState = {
  status: "idle" | "running" | "success" | "error";
  message: string;
};

const initialState: ViewState = {
  status: "idle",
  message: "Ready to connect to the local Python sidecar."
};

export default function App() {
  const [viewState, setViewState] = useState<ViewState>(initialState);

  async function handleSubmit(inputPath: string, outputPath: string) {
    setViewState({
      status: "running",
      message: "Processing request sent to the local engine."
    });

    try {
      const response = await processAudio({ inputPath, outputPath });
      setViewState({
        status: "success",
        message: `Finished: ${response.file}`
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown engine error";

      setViewState({
        status: "error",
        message
      });
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Local AI Audio Cleanup</p>
        <h1>Noise Reduction</h1>
        <p className="hero-copy">
          React handles the interface, Tauri owns the desktop shell, and the
          Python sidecar processes audio locally.
        </p>
      </section>

      <section className="panel-grid">
        <ProcessForm onSubmit={handleSubmit} />
        <StatusPanel status={viewState.status} message={viewState.message} />
      </section>
    </main>
  );
}

