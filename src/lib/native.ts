import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

export async function pickInputPath() {
  const result = await open({
    filters: [
      {
        name: "Audio and video",
        extensions: ["wav", "mp3", "m4a", "flac", "mp4", "mov", "mkv", "avi"],
      },
    ],
    multiple: false,
  });

  return Array.isArray(result) ? result[0] ?? null : result;
}

export async function pickOutputDirectory() {
  const result = await open({
    directory: true,
    multiple: false,
  });

  return Array.isArray(result) ? result[0] ?? null : result;
}

export async function revealOutput(path: string) {
  await revealItemInDir(path);
}

export async function checkForUpdates(): Promise<Update | null> {
  return check();
}

export async function installUpdate(update: Update) {
  await update.downloadAndInstall();
  await relaunch();
}
