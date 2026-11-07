"use client";

import { ChartNoAxesColumn, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewTabs } from "@/components/view-tabs";
import { useAnalytics } from "@/hooks/use-analytics";
import { useToday } from "@/hooks/use-today";
import { delta, formatHours, percent, previousLabel } from "@/lib/analytics";
import { areaLabel } from "@/lib/tasks";
import type { AnalyticsReport, Period } from "@/lib/types/analytics";
import { cn } from "@/lib/utils";

import { DailyBars } from "./daily-bars";

const periods = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
] as const;

const BACK_LIMIT: Record<Period, number> = { week: -104, month: -24 };

function Stat({ label, value, detail }: { label: string; value: string; detail: string | null }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <dt className="micro-label">{label}</dt>
      <dd className="font-mono text-2xl tabular-nums">{value}</dd>
      {detail && <dd className="font-mono text-[0.6875rem] text-faint">{detail}</dd>}
    </div>
  );
}

function Stats({ report }: { report: AnalyticsReport }) {
  const { totals, previous } = report;
  const change = delta(totals.completed, previous.completed);
  const deadlines = totals.deadlines_met + totals.deadlines_missed;
  const adherence = percent(totals.habit_done, totals.habit_expected);
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card/80 lg:grid-cols-4 [&>div]:border-border lg:[&>div+div]:border-l max-lg:[&>div:nth-child(-n+2)]:border-b max-lg:[&>div:nth-child(even)]:border-l">
      <Stat
        label="Completed"
        value={String(totals.completed)}
        detail={`${change.text} vs ${previousLabel(report.period)}`}
      />
      <Stat
        label="Deadlines met"
        value={deadlines ? `${totals.deadlines_met}/${deadlines}` : "—"}
        detail={deadlines ? `${totals.deadlines_missed} missed` : "none due yet"}
      />
      <Stat
        label="Habit adherence"
        value={adherence === null ? "—" : `${adherence}%`}
        detail={
          adherence === null
            ? "nothing due yet"
            : `${totals.habit_done} of ${totals.habit_expected} done`
        }
      />
      <Stat
        label="Inbox"
        value={`${totals.processed}/${totals.captured}`}
        detail={
          report.inbox_median_hours === null
            ? "processed / captured"
            : `median ${formatHours(report.inbox_median_hours)} to process`
        }
      />
    </dl>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card/80 p-4"
    >
      <h2 className="micro-label">{title}</h2>
      {children}
    </section>
  );
}

function AreaBreakdown({ report }: { report: AnalyticsReport }) {
  const max = Math.max(1, ...report.completed_by_area.map((row) => row.count));
  if (report.completed_by_area.length === 0) {
    return <p className="text-sm text-muted-foreground">No completed tasks in this period.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {report.completed_by_area.map((row) => (
        <li
          key={row.area ?? "none"}
          className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-3 text-sm"
        >
          <span className="truncate text-muted-foreground">
            {row.area ? areaLabel(row.area) : "No area"}
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </span>
          <span className="text-right font-mono text-xs tabular-nums">{row.count}</span>
        </li>
      ))}
    </ul>
  );
}

function HabitBreakdown({ report }: { report: AnalyticsReport }) {
  if (report.habits.length === 0) {
    return <p className="text-sm text-muted-foreground">No habit was due in this period.</p>;
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {report.habits.map((habit) => {
        // Progress toward everything due so far plus what is still open, so a running week reads honestly.
        const due = habit.expected + habit.open;
        const share = due ? habit.done / due : 0;
        return (
          <li key={habit.id} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3 text-sm">
            <span className="truncate text-muted-foreground">
              {habit.title}
              {habit.open > 0 && (
                <span className="ml-1.5 font-mono text-[0.625rem] text-faint">
                  {habit.open} open
                </span>
              )}
            </span>
            <span
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${habit.done} of ${habit.expected + habit.open}${habit.open ? `, ${habit.open} still open` : ""}`}
            >
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${share * 100}%` }}
              />
            </span>
            <span className="text-right font-mono text-xs tabular-nums">
              {habit.done}/{habit.expected + habit.open}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function AnalyticsView() {
  const [period, setPeriod] = useState<Period>("week");
  const [offset, setOffset] = useState(0);
  const analytics = useAnalytics(period, offset);
  const today = useToday();
  const report = analytics.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewTabs
          label="Period"
          views={periods}
          value={period}
          onChange={(next) => {
            setPeriod(next);
            setOffset(0);
          }}
        />
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Previous ${period}`}
            disabled={offset <= BACK_LIMIT[period]}
            onClick={() => setOffset(offset - 1)}
          >
            <ChevronLeft />
          </Button>
          <span
            className={cn(
              "min-w-36 text-center font-mono text-xs",
              analytics.isFetching && "opacity-60",
            )}
            aria-live="polite"
          >
            {report?.label ?? "…"}
          </span>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Next ${period}`}
            disabled={offset >= 0}
            onClick={() => setOffset(offset + 1)}
          >
            <ChevronRight />
          </Button>
          {offset !== 0 && (
            <Button size="sm" variant="ghost" onClick={() => setOffset(0)}>
              This {period}
            </Button>
          )}
        </div>
      </div>

      {analytics.isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : analytics.isError ? (
        <EmptyState icon={ChartNoAxesColumn} title="Analytics couldn't load">
          {analytics.error.message}
        </EmptyState>
      ) : (
        <>
          <Stats report={analytics.data} />

          <section
            aria-label="Observations"
            className="rounded-xl border border-border bg-card/80 p-4"
          >
            <h2 className="micro-label mb-2">Observations</h2>
            {analytics.data.observations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Not enough activity in this period to say anything yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {analytics.data.observations.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden="true" className="font-mono text-primary">
                      ›
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Panel title="Tasks completed per day">
            <DailyBars
              days={analytics.data.completed_by_day}
              period={analytics.data.period}
              today={today}
            />
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Completed by area">
              <AreaBreakdown report={analytics.data} />
            </Panel>
            <Panel title="Habits">
              <HabitBreakdown report={analytics.data} />
            </Panel>
          </div>

          <p className="font-mono text-[0.6875rem] text-faint">
            {analytics.data.totals.created} tasks created · {analytics.data.totals.cancelled}{" "}
            cancelled · {analytics.data.totals.notes_edited} notes edited
          </p>
        </>
      )}
    </div>
  );
}
