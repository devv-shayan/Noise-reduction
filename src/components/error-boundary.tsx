"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

async function logRenderCrash(message: string) {
  try {
    await invoke("log_client_event", {
      level: "fatal",
      message,
    });
  } catch {
    // Ignore logging failures while handling the original crash.
  }
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    void logRenderCrash(
      `react-error-boundary: ${error.message}\n${error.stack ?? ""}\n${errorInfo.componentStack}`
    );
  }

  render() {
    if (this.state.error) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
          <div className="max-w-2xl rounded-2xl border border-destructive/40 bg-card p-6 shadow-sm">
            <h1 className="mb-3 text-lg font-semibold text-destructive">
              Frontend runtime error
            </h1>
            <p className="mb-4 text-sm text-muted-foreground">
              The app hit a client-side exception after launch. Check
              `desktop-bootstrap.log` for the exact stack trace.
            </p>
            <pre className="overflow-auto whitespace-pre-wrap text-sm">
              {this.state.error.message}
            </pre>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
