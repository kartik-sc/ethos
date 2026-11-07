"use client";

import { Shield } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { LogButton, LogForm } from "@/components/habits/log-controls";
import { RecentStrip } from "@/components/habits/recent-strip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHabits } from "@/hooks/use-habits";
import { describeTarget, isDueToday } from "@/lib/habits";
import type { Habit } from "@/lib/types/habits";
import { cn } from "@/lib/utils";

function TodayRow({ habit }: { habit: Habit }) {
  const [logging, setLogging] = useState(false);
  const target = describeTarget(habit);
  const done = !isDueToday(habit);

  return (
    <li className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="flex w-24 shrink-0 justify-start">
          <LogButton habit={habit} onOpenForm={() => setLogging((open) => !open)} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "flex items-center gap-1.5 truncate text-sm",
              done && "text-muted-foreground",
            )}
          >
            {habit.protected && (
              <Shield aria-label="Protected" className="size-3 shrink-0 text-primary" />
            )}
            {habit.title}
          </p>
          <p className="font-mono text-[0.6875rem] text-faint">
            {habit.cadence === "weekly"
              ? `${habit.summary.week_done} of ${habit.summary.week_target} this week`
              : (target ?? "today")}
            {habit.summary.streak > 0 &&
              ` · ${habit.summary.streak}${habit.summary.streak_unit === "days" ? "d" : "w"} streak`}
          </p>
        </div>
        <div className="hidden sm:block">
          <RecentStrip days={habit.summary.recent} />
        </div>
      </div>
      <AnimatePresence initial={false}>
        {logging && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <LogForm habit={habit} onClose={() => setLogging(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/** Habits that ask for something today, then those already done, so the list stays stable. */
export function HabitsToday() {
  const habits = useHabits();
  const relevant = (habits.data ?? []).filter(
    (habit) => habit.cadence === "weekly" || habit.summary.today.state !== "rest",
  );
  const due = relevant.filter(isDueToday);
  const done = relevant.filter((habit) => !isDueToday(habit));

  return (
    <motion.section
      aria-labelledby="habits-today-heading"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border border-border bg-card/80 backdrop-blur-[2px]"
    >
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-2.5">
        <h2 id="habits-today-heading" className="micro-label">
          Habits today
        </h2>
        {habits.data && relevant.length > 0 && (
          <span className="font-mono text-[0.6875rem] text-faint">
            {done.length}/{relevant.length} done
          </span>
        )}
      </div>

      {habits.isPending ? (
        <div className="space-y-3 px-4 py-4" aria-busy="true">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ) : habits.isError ? (
        <div className="flex items-center justify-between gap-3 px-4 py-4 text-sm text-muted-foreground">
          <span>Habits are unavailable: {habits.error.message}.</span>
          <button
            type="button"
            onClick={() => void habits.refetch()}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            Retry
          </button>
        </div>
      ) : relevant.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <p className="text-sm text-muted-foreground">
            {habits.data.length === 0 ? "No habits yet." : "Nothing scheduled today."}
          </p>
          {habits.data.length === 0 && (
            <Button size="sm" variant="outline" render={<Link href="/habits" />}>
              Create a habit
            </Button>
          )}
        </div>
      ) : (
        <ul>
          {[...due, ...done].map((habit) => (
            <TodayRow key={habit.id} habit={habit} />
          ))}
        </ul>
      )}
    </motion.section>
  );
}
