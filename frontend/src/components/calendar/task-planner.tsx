"use client";

import { CalendarRange } from "lucide-react";
import { useState } from "react";

import { fieldClass } from "@/components/form-controls";
import { Button } from "@/components/ui/button";
import { usePlanTasks } from "@/hooks/use-calendar";
import { useTimezone } from "@/hooks/use-timezone";
import { useToday } from "@/hooks/use-today";
import { durationLabel, formatSlot, unplacedReason } from "@/lib/calendar";
import { formatShortDate } from "@/lib/time";
import type { PlanResult } from "@/lib/types/calendar";
import { cn } from "@/lib/utils";

const HORIZONS = [1, 3, 7, 14] as const;

function minutesBetween(start: string, end: string): number {
  return Math.round((Date.parse(end) - Date.parse(start)) / 60_000);
}

function PlanPreview({
  plan,
  timeZone,
  today,
}: {
  plan: PlanResult;
  timeZone: string;
  today: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {plan.placed.length > 0 && (
        <ol aria-label="Blocks" className="divide-y divide-border rounded-lg border border-border">
          {plan.placed.map((block) => (
            <li key={block.task_id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-40 shrink-0 font-mono text-[0.6875rem] text-faint">
                {formatSlot(block.starts_at, block.ends_at, timeZone, today)}
              </span>
              <span className="min-w-0 flex-1 truncate">{block.title}</span>
              <span className="font-mono text-[0.6875rem] text-faint">
                {durationLabel(minutesBetween(block.starts_at, block.ends_at))}
              </span>
            </li>
          ))}
        </ol>
      )}
      {plan.unplaced.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="micro-label text-warning">Doesn&apos;t fit</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {plan.unplaced.map((task) => (
              <li key={task.task_id} className="flex flex-wrap gap-x-2">
                <span>{task.title}</span>
                <span className="font-mono text-[0.6875rem] text-faint">
                  {durationLabel(task.minutes)}
                  {task.due_date && ` · due ${formatShortDate(task.due_date)}`}
                </span>
                <span className="w-full text-xs text-muted-foreground">
                  {unplacedReason(task.reason)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {plan.placed.length === 0 && plan.unplaced.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing to plan. Tasks are planned when they are due in this period or have a duration,
          and aren&apos;t already scheduled.
        </p>
      )}
    </div>
  );
}

/** Previews blocks for open tasks in free time, then creates them on request. */
export function TaskPlanner() {
  const [horizon, setHorizon] = useState<number>(7);
  const preview = usePlanTasks();
  const apply = usePlanTasks();
  const timeZone = useTimezone();
  const today = useToday();
  const plan = preview.data;

  function reset() {
    preview.reset();
    apply.reset();
  }

  return (
    <section
      id="plan"
      aria-labelledby="plan-heading"
      className="flex scroll-mt-8 flex-col gap-4 rounded-xl border border-border bg-card/80 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <CalendarRange aria-hidden="true" className="size-4 text-faint" />
          <h2 id="plan-heading" className="text-sm font-medium">
            Plan into free time
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="plan-horizon" className="sr-only">
            Days to plan
          </label>
          <select
            id="plan-horizon"
            value={horizon}
            onChange={(event) => {
              setHorizon(Number(event.target.value));
              reset();
            }}
            className={cn(fieldClass, "h-8 w-auto text-xs")}
          >
            {HORIZONS.map((days) => (
              <option key={days} value={days}>
                {days === 1 ? "Today" : `Next ${days} days`}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={preview.isPending}
            onClick={() => {
              apply.reset();
              preview.mutate({ horizon_days: horizon, apply: false });
            }}
          >
            Preview
          </Button>
        </div>
      </div>

      {preview.isError && (
        <p role="alert" className="text-xs text-destructive">
          Couldn&apos;t plan: {preview.error.message}.
        </p>
      )}

      {apply.isSuccess ? (
        <p role="status" className="text-sm text-muted-foreground">
          {apply.data.placed.length} block{apply.data.placed.length === 1 ? "" : "s"} added
          {apply.data.unplaced.length > 0 && `, ${apply.data.unplaced.length} didn't fit`}. They
          sync to Google Calendar once it is connected.
        </p>
      ) : (
        plan &&
        timeZone &&
        today && (
          <>
            <PlanPreview plan={plan} timeZone={timeZone} today={today} />
            {plan.placed.length > 0 && (
              <div className="flex items-center justify-end gap-2">
                {apply.isError && (
                  <span role="alert" className="text-xs text-destructive">
                    {apply.error.message}
                  </span>
                )}
                <Button size="sm" variant="ghost" onClick={reset}>
                  Discard
                </Button>
                <Button
                  size="sm"
                  disabled={apply.isPending}
                  onClick={() => apply.mutate({ horizon_days: horizon, apply: true })}
                >
                  Add {plan.placed.length} block{plan.placed.length === 1 ? "" : "s"}
                </Button>
              </div>
            )}
          </>
        )
      )}

      {!plan && !apply.isSuccess && (
        <p className="text-xs text-muted-foreground">
          Uses free time inside your working day, in deadline and priority order. Existing blocks
          and calendar events never move; what doesn&apos;t fit is listed, not squeezed in.
        </p>
      )}
    </section>
  );
}
