import type { Metadata } from "next";

import { AnalyticsSnapshot } from "@/components/home/analytics-snapshot";
import { DeadlineRadar } from "@/components/home/deadline-radar";
import { Greeting } from "@/components/home/greeting";
import { HabitsToday } from "@/components/home/habits-today";
import { AgendaPanel } from "@/components/calendar/agenda-panel";
import { QuoteCard, TaskStrip } from "@/components/home/home-panels";
import { NextActionPanel } from "@/components/home/next-action";
import { QuickCapture } from "@/components/home/quick-capture";
import { SystemReadout } from "@/components/home/system-readout";

export const metadata: Metadata = { title: "Command Centre" };

export default function CommandCentrePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-10 md:py-12">
      <Greeting />
      {/* The phone gets a lighter Today: capture, agenda, next action and habits. */}
      <QuickCapture className="md:hidden" />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-3">
          <AgendaPanel />
          <NextActionPanel />
          <div className="hidden flex-col gap-6 md:flex">
            <TaskStrip />
            <DeadlineRadar />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <HabitsToday />
          <div className="hidden flex-col gap-6 md:flex">
            <AnalyticsSnapshot />
            <QuoteCard />
          </div>
        </div>
      </div>
      <div className="hidden md:block">
        <SystemReadout />
      </div>
    </div>
  );
}
