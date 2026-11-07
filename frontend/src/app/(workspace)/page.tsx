import type { Metadata } from "next";

import { Greeting } from "@/components/home/greeting";
import { HabitsToday } from "@/components/home/habits-today";
import { NextActionPanel } from "@/components/home/next-action";
import { SystemReadout } from "@/components/home/system-readout";

export const metadata: Metadata = { title: "Command Centre" };

export default function CommandCentrePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 md:gap-10 md:px-10 md:py-14">
      <Greeting />
      <NextActionPanel />
      <HabitsToday />
      <SystemReadout />
    </div>
  );
}
