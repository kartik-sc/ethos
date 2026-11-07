import type { Metadata } from "next";

import { HabitBoard } from "@/components/habits/habit-board";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Habits" };

export default function HabitsPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 md:px-10 md:py-14">
      <PageHeader
        title="Habits"
        description="Recurring commitments. Log today, keep streaks, and see consistency week by week."
      />
      <HabitBoard />
    </div>
  );
}
