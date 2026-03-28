type ProcessAudioRequest = {
  inputPath: string;
  outputPath: string;
};

type ProcessAudioResponse = {
  status: string;
  file: string;
};

const ENGINE_BASE_URL = "http://127.0.0.1:8000";

export async function processAudio(
  request: ProcessAudioRequest
): Promise<ProcessAudioResponse> {
  if (!request.inputPath.trim() || !request.outputPath.trim()) {
    throw new Error("Input and output paths are required");
  }

  const response = await fetch(`${ENGINE_BASE_URL}/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      input_path: request.inputPath,
      output_path: request.outputPath
    })
  });

  if (!response.ok) {
    const errorMessage = await response.text();
    throw new Error(errorMessage || "Engine request failed");
  }

  return (await response.json()) as ProcessAudioResponse;
}
