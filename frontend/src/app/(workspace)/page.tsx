import type { Metadata } from "next";

import { AnalyticsSnapshot } from "@/components/home/analytics-snapshot";
import { DeadlineRadar } from "@/components/home/deadline-radar";
import { Greeting } from "@/components/home/greeting";
import { HabitsToday } from "@/components/home/habits-today";
import { AgendaPanel } from "@/components/calendar/agenda-panel";
import { QuoteCard, TaskStrip } from "@/components/home/home-panels";
import { NextActionPanel } from "@/components/home/next-action";
import { SystemReadout } from "@/components/home/system-readout";

export const metadata: Metadata = { title: "Command Centre" };

export default function CommandCentrePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-10 md:py-12">
      <Greeting />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-3">
          <AgendaPanel />
          <NextActionPanel />
          <TaskStrip />
          <DeadlineRadar />
        </div>
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <HabitsToday />
          <AnalyticsSnapshot />
          <QuoteCard />
        </div>
      </div>
      <SystemReadout />
    </div>
  );
}
