import type { ComponentType, SVGProps } from "react";

import AudioLinesIcon from "lucide-react/dist/esm/icons/audio-lines.js";
import ListChecksIcon from "lucide-react/dist/esm/icons/list-checks.js";
import Settings2Icon from "lucide-react/dist/esm/icons/settings-2.js";
import ShieldCheckIcon from "lucide-react/dist/esm/icons/shield-check.js";
import SparklesIcon from "lucide-react/dist/esm/icons/sparkles.js";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import type {
  EngineSetupStatus,
  NavigationView,
  ProcessingJob,
} from "@/lib/types";

type AppSidebarProps = {
  currentView: NavigationView;
  onViewChange: (view: NavigationView) => void;
  setupStatus: EngineSetupStatus;
  activeJob: ProcessingJob | null;
  jobCount: number;
  completedJobs: number;
  failedJobs: number;
};

const navItems: Array<{
  label: string;
  code: string;
  value: NavigationView;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}> = [
  {
    label: "PROCESS",
    code: "01",
    value: "process",
    Icon: AudioLinesIcon,
  },
  {
    label: "JOBS",
    code: "02",
    value: "jobs",
    Icon: ListChecksIcon,
  },
  {
    label: "SETTINGS",
    code: "03",
    value: "settings",
    Icon: Settings2Icon,
  },
];

export function AppSidebar({
  activeJob,
  completedJobs,
  currentView,
  failedJobs,
  jobCount,
  onViewChange,
  setupStatus,
}: AppSidebarProps) {
  return (
    <Sidebar className="noise-sidebar" collapsible="icon" variant="inset">
      <SidebarHeader className="gap-2 p-3">
        <div className="noise-sidebar-panel px-3 py-3 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0">
          <p className="noise-kicker group-data-[collapsible=icon]:hidden">MENU</p>
          <div className="mt-3 flex items-center justify-between gap-3 group-data-[collapsible=icon]:mt-0 group-data-[collapsible=icon]:justify-center">
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold uppercase tracking-[0.2em]">
                NOISE REDUCTION
              </p>
              <p className="mt-1 truncate text-xs text-sidebar-foreground/65">
                choose a page
              </p>
            </div>
            <SparklesIcon />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-2">
        <SidebarGroup>
          <SidebarGroupLabel>pages</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0">
              {navItems.map(({ Icon, code, label, value }) => (
                <SidebarMenuItem key={value}>
                  <SidebarMenuButton
                    className="gap-3 px-3 py-3"
                    isActive={currentView === value}
                    onClick={() => onViewChange(value)}
                    size="lg"
                    tooltip={label}
                  >
                    <Icon />
                    <div className="grid min-w-0 flex-1 grid-cols-[34px_minmax(0,1fr)] items-center gap-3 text-left group-data-[collapsible=icon]:hidden">
                      <span className="truncate text-[0.7rem] tracking-[0.18em] text-sidebar-foreground/55">
                        {code}
                      </span>
                      <span className="truncate">{label}</span>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>app status</SidebarGroupLabel>
          <SidebarGroupContent className="px-2">
            <div className="noise-sidebar-panel px-3 py-3">
              <div className="noise-list">
                <div className="noise-list__row">
                  <span>SETUP</span>
                  <span>{setupStatus.modelReady ? "READY" : "NOT YET"}</span>
                </div>
                <div className="noise-list__row">
                  <span>CURRENT JOB</span>
                  <span>{activeJob ? activeJob.status.toUpperCase() : "NONE"}</span>
                </div>
                <div className="noise-list__row">
                  <span>FINISHED</span>
                  <span>{completedJobs}</span>
                </div>
                <div className="noise-list__row">
                  <span>ISSUES</span>
                  <span>{failedJobs}</span>
                </div>
                <div className="noise-list__row">
                  <span>TOTAL JOBS</span>
                  <span>{jobCount}</span>
                </div>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 pt-0 text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
        <div className="noise-sidebar-panel flex items-start gap-3 px-3 py-3">
          <ShieldCheckIcon className="mt-0.5" />
          <div className="min-w-0">
            <p className="font-medium uppercase tracking-[0.14em]">
              private by default
            </p>
            <p className="mt-1 leading-relaxed text-sidebar-foreground/65">
              Your files stay on this device. Use Ctrl/Cmd+B to hide the menu.
            </p>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
