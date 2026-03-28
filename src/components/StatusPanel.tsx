type StatusPanelProps = {
  status: "idle" | "running" | "success" | "error";
  message: string;
};

export function StatusPanel({ status, message }: StatusPanelProps) {
  return (
    <section className="panel">
      <div className={`status-pill ${status}`}>Status: {status}</div>
      <h2>Engine Contract</h2>
      <p>
        Frontend requests are sent to `POST /process` on the local FastAPI
        service at `127.0.0.1:8000`.
      </p>
      <p>{message}</p>
    </section>
  );
}

