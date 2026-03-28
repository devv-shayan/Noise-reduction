import { FormEvent, useState } from "react";

type ProcessFormProps = {
  onSubmit: (inputPath: string, outputPath: string) => Promise<void>;
};

export function ProcessForm({ onSubmit }: ProcessFormProps) {
  const [inputPath, setInputPath] = useState("");
  const [outputPath, setOutputPath] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(inputPath.trim(), outputPath.trim());
  }

  return (
    <section className="panel">
      <h2>Process Audio</h2>
      <p>
        Use absolute paths for now. Tauri file picker integration belongs in the
        next implementation pass.
      </p>

      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="inputPath">Input audio file</label>
          <input
            id="inputPath"
            name="inputPath"
            placeholder="C:\\audio\\meeting-noisy.wav"
            value={inputPath}
            onChange={(event) => setInputPath(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="outputPath">Output audio file</label>
          <input
            id="outputPath"
            name="outputPath"
            placeholder="C:\\audio\\meeting-clean.wav"
            value={outputPath}
            onChange={(event) => setOutputPath(event.target.value)}
          />
        </div>

        <button className="submit-button" type="submit">
          Send To Engine
        </button>
      </form>
    </section>
  );
}

