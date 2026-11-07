import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/page-header";
import { ThemeSetting } from "@/components/settings/theme-setting";
import { DEFAULT_TIMEZONE } from "@/lib/time";

export const metadata: Metadata = { title: "Settings" };

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 md:px-10 md:py-14">
      <PageHeader title="Settings" description="Preferences for this Ethos workspace." />

      <section aria-labelledby="appearance-heading">
        <h2 id="appearance-heading" className="micro-label">
          Appearance
        </h2>
        <div className="divide-y divide-border">
          <SettingRow label="Theme" description="Ethos never switches theme automatically.">
            <ThemeSetting />
          </SettingRow>
        </div>
      </section>

      <section aria-labelledby="time-heading">
        <h2 id="time-heading" className="micro-label">
          Time
        </h2>
        <div className="divide-y divide-border">
          <SettingRow label="Timezone" description="Becomes configurable with calendar scheduling.">
            <span className="font-mono text-xs text-muted-foreground">{DEFAULT_TIMEZONE}</span>
          </SettingRow>
        </div>
      </section>
    </div>
  );
}
