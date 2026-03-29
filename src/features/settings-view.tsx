import DownloadIcon from "lucide-react/dist/esm/icons/download.js";
import MoonIcon from "lucide-react/dist/esm/icons/moon.js";
import RefreshCwIcon from "lucide-react/dist/esm/icons/refresh-cw.js";
import SunIcon from "lucide-react/dist/esm/icons/sun.js";
import SunMoonIcon from "lucide-react/dist/esm/icons/sun-moon.js";

import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { AppSettings, BootstrapPayload, EngineSetupStatus } from "@/lib/types";

type SettingsViewProps = {
  bootstrap: BootstrapPayload | null;
  isCheckingUpdates: boolean;
  onCheckUpdates: () => Promise<void>;
  onDownloadModel: () => Promise<void>;
  onSettingsChange: (settings: AppSettings) => void;
  settings: AppSettings;
  setupStatus: EngineSetupStatus;
};

export function SettingsView({
  bootstrap,
  isCheckingUpdates,
  onCheckUpdates,
  onDownloadModel,
  onSettingsChange,
  settings,
  setupStatus,
}: SettingsViewProps) {
  const { setTheme, theme } = useTheme();

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="noise-panel px-6 py-6 md:px-8 md:py-7" data-motion="rise">
        <div className="flex flex-col gap-6">
          <div>
            <p className="noise-kicker">SYSTEM CONFIG // LOCAL RUNTIME</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Theme, hardware, and cache control
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Configure visual mode, choose the default compute preference, and
              inspect the model cache used by the engine.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="noise-panel-block">
              <FieldGroup>
                <Field orientation="responsive">
                  <FieldContent>
                    <FieldTitle>Theme</FieldTitle>
                    <FieldDescription>
                      Switch between light, dark, or system-driven console mode.
                    </FieldDescription>
                  </FieldContent>
                  <ToggleGroup
                    onValueChange={(value) => {
                      if (!value) {
                        return;
                      }
                      setTheme(value);
                      onSettingsChange({
                        ...settings,
                        theme: value as AppSettings["theme"],
                      });
                    }}
                    type="single"
                    value={theme ?? settings.theme}
                  >
                    <ToggleGroupItem value="light">
                      <SunIcon />
                      Light
                    </ToggleGroupItem>
                    <ToggleGroupItem value="dark">
                      <MoonIcon />
                      Dark
                    </ToggleGroupItem>
                    <ToggleGroupItem value="system">
                      <SunMoonIcon />
                      System
                    </ToggleGroupItem>
                  </ToggleGroup>
                </Field>
              </FieldGroup>
            </div>

            <div className="noise-panel-block">
              <FieldGroup>
                <Field orientation="responsive">
                  <FieldContent>
                    <FieldTitle>Default compute mode</FieldTitle>
                    <FieldDescription>
                      Auto uses GPU when available and falls back to CPU otherwise.
                    </FieldDescription>
                  </FieldContent>
                  <ToggleGroup
                    onValueChange={(value) => {
                      if (!value) {
                        return;
                      }
                      onSettingsChange({
                        ...settings,
                        computePreference: value as AppSettings["computePreference"],
                      });
                    }}
                    type="single"
                    value={settings.computePreference}
                  >
                    <ToggleGroupItem value="auto">Auto</ToggleGroupItem>
                    <ToggleGroupItem value="cpu">CPU</ToggleGroupItem>
                    <ToggleGroupItem value="gpu">GPU</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
              </FieldGroup>
            </div>
          </div>

          <div className="grid gap-6 border-t border-dotted border-border pt-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="noise-panel-block">
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="noise-panel-title">MODEL CACHE</h3>
                  <p className="noise-panel-subtitle">
                    Local weights and backend state used by the engine.
                  </p>
                </div>

                <div className="noise-list">
                  <div className="noise-list__row">
                    <span>STATUS</span>
                    <span>{setupStatus.modelReady ? "READY" : "PENDING"}</span>
                  </div>
                  <div className="noise-list__row">
                    <span>VERSION</span>
                    <span>{setupStatus.modelVersion ?? "NOT DOWNLOADED"}</span>
                  </div>
                  <div className="noise-list__row">
                    <span>PATH</span>
                    <span className="truncate">
                      {setupStatus.cachePath || bootstrap?.paths.modelDir || "PENDING"}
                    </span>
                  </div>
                  <div className="noise-list__row">
                    <span>BACKEND</span>
                    <span>
                      {(setupStatus.activeBackend ?? settings.computePreference).toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="noise-panel-block">
              <div className="flex h-full flex-col justify-between gap-5">
                <div>
                  <h3 className="noise-panel-title">CACHE ACTION</h3>
                  <p className="noise-panel-subtitle">
                    Refresh the cached model if you need to recover from a partial
                    download or replace local weights.
                  </p>
                </div>
                <Button onClick={() => void onDownloadModel()} size="sm" variant="outline">
                  <DownloadIcon data-icon="inline-start" />
                  Refresh model cache
                </Button>
              </div>
            </div>
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
              <h3 className="noise-panel-title">RELEASE CHANNEL</h3>
              <p className="noise-panel-subtitle">
                Desktop updater, platform, and log path metadata.
              </p>
            </div>

            <div className="noise-list">
              <div className="noise-list__row">
                <span>APP_VERSION</span>
                <span>{bootstrap?.appVersion ?? "UNKNOWN"}</span>
              </div>
              <div className="noise-list__row">
                <span>PLATFORM</span>
                <span>{bootstrap?.platform ?? "UNKNOWN"}</span>
              </div>
              <div className="noise-list__row">
                <span>UPDATER</span>
                <span>{bootstrap?.updaterAvailable ? "ENABLED" : "DISABLED"}</span>
              </div>
              <div className="noise-list__row">
                <span>LOGS</span>
                <span className="truncate">{bootstrap?.paths.logDir ?? "PENDING"}</span>
              </div>
            </div>

            <Separator />

            <Button
              disabled={isCheckingUpdates || !bootstrap?.updaterAvailable}
              onClick={() => void onCheckUpdates()}
              size="sm"
              variant="outline"
            >
              {isCheckingUpdates ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCwIcon data-icon="inline-start" />
              )}
              Check for updates
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
