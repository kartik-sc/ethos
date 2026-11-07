"use client";

import { RotateCcw, Target, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { QuickCreate } from "@/components/quick-create";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewTabs } from "@/components/view-tabs";
import { useCreateGoal, useGoals, useRestoreGoal } from "@/hooks/use-goals";
import { useNow } from "@/hooks/use-now";
import { useToday } from "@/hooks/use-today";
import { goalRatio, goalSummary } from "@/lib/goals";
import { areaLabel, describeDue } from "@/lib/tasks";
import { trashLabel } from "@/lib/trash";
import type { Goal, GoalView } from "@/lib/types/goals";
import { cn } from "@/lib/utils";

import { ProgressRing } from "./progress-ring";

const views = [
  { value: "active", label: "Active" },
  { value: "trash", label: "Trash" },
] as const;

function GoalCard({ goal, today }: { goal: Goal; today: string | null }) {
  const target = goal.target_date && today ? describeDue(goal.target_date, today) : null;

  return (
    <Link
      href={`/goals/${goal.id}`}
      className="flex items-center gap-4 rounded-xl border border-border bg-card/80 p-4 transition-colors outline-none hover:border-border-strong hover:bg-card focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ProgressRing ratio={goalRatio(goal.progress)} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="truncate text-[0.9375rem] font-medium tracking-[-0.01em]">{goal.title}</h2>
          {target && (
            <span
              className={cn(
                "shrink-0 font-mono text-[0.6875rem]",
                target.tone === "overdue" ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {target.tone === "overdue"
                ? target.text.toLowerCase()
                : `by ${target.text.toLowerCase()}`}
            </span>
          )}
        </div>
        {goal.description && (
          <p className="line-clamp-1 text-xs text-muted-foreground">{goal.description}</p>
        )}
        <p className="flex flex-wrap gap-x-3 font-mono text-[0.6875rem] text-faint">
          <span>{goalSummary(goal.progress)}</span>
          {goal.area && <span>{areaLabel(goal.area).toLowerCase()}</span>}
        </p>
      </div>
    </Link>
  );
}

function TrashRow({ goal }: { goal: Goal }) {
  const restore = useRestoreGoal();
  const now = useNow();

  return (
    <li className="flex flex-col gap-1 border-b border-border px-4 py-2.5 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{goal.title}</p>
          {goal.deleted_at && now && (
            <p className="font-mono text-[0.6875rem] text-faint">
              {trashLabel(goal.deleted_at, now)} · links come back with it
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => restore.mutate(goal.id)}
          disabled={restore.isPending}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Restore
        </button>
      </div>
      {restore.isError && (
        <p role="alert" className="text-xs text-destructive">
          Couldn&apos;t restore: {restore.error.message}.
        </p>
      )}
    </li>
  );
}

export function GoalIndex() {
  const [view, setView] = useState<GoalView>("active");
  const goals = useGoals(view);
  const create = useCreateGoal();
  const today = useToday();

  return (
    <div className="flex flex-col gap-6">
      <QuickCreate
        id="new-goal-title"
        label="New goal"
        placeholder="Name a goal and press Enter"
        dateLabel="Target date"
        pending={create.isPending}
        error={create.error}
        onCreate={(title, targetDate, reset) =>
          create.mutate({ title, target_date: targetDate }, { onSuccess: reset })
        }
      />

      <div className="flex items-center justify-between gap-3">
        <ViewTabs label="Goal views" views={views} value={view} onChange={setView} />
        {goals.data && (
          <span className="font-mono text-[0.6875rem] text-faint" aria-live="polite">
            {goals.data.length} {view === "trash" ? "deleted" : "active"}
          </span>
        )}
      </div>

      {goals.isPending ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          {[0, 1].map((key) => (
            <div
              key={key}
              className="flex items-center gap-4 rounded-xl border border-border bg-card/80 p-4"
            >
              <Skeleton className="size-14 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : goals.isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
        >
          <span className="text-muted-foreground">
            Goals couldn&apos;t load: {goals.error.message}.
          </span>
          <button
            type="button"
            onClick={() => void goals.refetch()}
            className="rounded-md px-2 py-1 text-xs font-medium text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            Try again
          </button>
        </div>
      ) : goals.data.length === 0 ? (
        view === "active" ? (
          <EmptyState icon={Target} title="No goals yet">
            Name one above, then link projects and tasks to it. Progress comes from that work.
          </EmptyState>
        ) : (
          <EmptyState icon={Trash2} title="Trash is empty">
            Deleted goals land here. Their projects and tasks are never deleted with them.
          </EmptyState>
        )
      ) : view === "active" ? (
        <div className="flex flex-col gap-3">
          {goals.data.map((goal) => (
            <GoalCard key={goal.id} goal={goal} today={today} />
          ))}
        </div>
      ) : (
        <ul className="rounded-xl border border-border bg-card/80">
          {goals.data.map((goal) => (
            <TrashRow key={goal.id} goal={goal} />
          ))}
        </ul>
      )}
    </div>
  );
}
