"use client";

import { Plus, Repeat, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewTabs } from "@/components/view-tabs";
import { useCreateHabit, useHabits } from "@/hooks/use-habits";
import type { HabitView } from "@/lib/types/habits";

import { HabitForm } from "./habit-form";
import { HabitRow, TrashedHabitRow } from "./habit-row";

const views = [
  { value: "active", label: "Active" },
  { value: "trash", label: "Trash" },
] as const;

export function HabitBoard() {
  const [view, setView] = useState<HabitView>("active");
  const [creating, setCreating] = useState(false);
  const habits = useHabits(view);
  const create = useCreateHabit();

  return (
    <div className="flex flex-col gap-6">
      <AnimatePresence initial={false} mode="popLayout">
        {creating ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-border bg-card/80 p-4"
          >
            <HabitForm
              submitLabel="Create habit"
              pending={create.isPending}
              error={create.error}
              onCancel={() => setCreating(false)}
              onSubmit={(input) => create.mutate(input, { onSuccess: () => setCreating(false) })}
            />
          </motion.div>
        ) : (
          <motion.div key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Button variant="outline" onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              New habit
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3">
        <ViewTabs label="Habit views" views={views} value={view} onChange={setView} />
        {habits.data && (
          <span className="font-mono text-[0.6875rem] text-faint" aria-live="polite">
            {habits.data.length} {view === "trash" ? "deleted" : "active"}
          </span>
        )}
      </div>

      {habits.isPending ? (
        <div className="rounded-xl border border-border bg-card/80" aria-hidden="true">
          {[60, 45, 70].map((width) => (
            <div
              key={width}
              className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0"
            >
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="h-3.5" style={{ width: `${width}%` }} />
            </div>
          ))}
        </div>
      ) : habits.isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
        >
          <span className="text-muted-foreground">
            Habits couldn&apos;t load: {habits.error.message}.
          </span>
          <button
            type="button"
            onClick={() => void habits.refetch()}
            className="rounded-md px-2 py-1 text-xs font-medium text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            Try again
          </button>
        </div>
      ) : habits.data.length === 0 ? (
        view === "active" ? (
          <EmptyState icon={Repeat} title="No habits yet">
            Create one above: daily on chosen days, or a number of times a week.
          </EmptyState>
        ) : (
          <EmptyState icon={Trash2} title="Trash is empty">
            Deleted habits land here with their full history and can be restored.
          </EmptyState>
        )
      ) : view === "active" ? (
        <ul className="rounded-xl border border-border bg-card/80">
          {habits.data.map((habit) => (
            <HabitRow key={habit.id} habit={habit} />
          ))}
        </ul>
      ) : (
        <ul className="rounded-xl border border-border bg-card/80">
          {habits.data.map((habit) => (
            <TrashedHabitRow key={habit.id} habit={habit} />
          ))}
        </ul>
      )}
    </div>
  );
}
