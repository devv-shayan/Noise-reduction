import { z } from "zod";

import type { AppSettings } from "@/lib/types";

const storageKey = "noise-reduction.settings.v1";

const settingsSchema = z.object({
  version: z.literal(1),
  theme: z.enum(["light", "dark", "system"]),
  computePreference: z.enum(["auto", "cpu", "gpu"]),
  defaultOutputFormat: z.enum(["wav", "flac"]),
  autoCheckUpdates: z.boolean(),
});

export const defaultSettings: AppSettings = {
  version: 1,
  theme: "light",
  computePreference: "auto",
  defaultOutputFormat: "wav",
  autoCheckUpdates: true,
};

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") {
    return defaultSettings;
  }

  const rawValue = window.localStorage.getItem(storageKey);
  if (!rawValue) {
    return defaultSettings;
  }

  const result = settingsSchema.safeParse(JSON.parse(rawValue));
  return result.success ? result.data : defaultSettings;
}

export function saveSettings(settings: AppSettings) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(settings));
}
