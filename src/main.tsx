import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/error-boundary";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "./components/ui/sonner";
import { invoke } from "@tauri-apps/api/core";
import "./index.css";

async function logClientBootstrapEvent(level: string, message: string) {
  try {
    await invoke("log_client_event", { level, message });
  } catch {
    // Ignore logging failures during crash reporting.
  }
}

window.addEventListener("error", (event) => {
  void logClientBootstrapEvent(
    "fatal",
    `window-error: ${event.message}\n${event.error?.stack ?? ""}`
  );
});

window.addEventListener("unhandledrejection", (event) => {
  const reason =
    event.reason instanceof Error
      ? `${event.reason.message}\n${event.reason.stack ?? ""}`
      : String(event.reason);
  void logClientBootstrapEvent("fatal", `unhandled-rejection: ${reason}`);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      disableTransitionOnChange
      enableSystem
    >
      <ErrorBoundary>
        <App />
        <Toaster richColors />
      </ErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>
);
