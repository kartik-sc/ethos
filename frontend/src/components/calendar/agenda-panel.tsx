"use client";

import { CalendarClock, Lock, X } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

import { Skeleton } from "@/components/ui/skeleton";
import { useCalendarBlocks, useCalendarStatus, useRemoveBlock } from "@/hooks/use-calendar";
import { useNow } from "@/hooks/use-now";
import { useTimezone } from "@/hooks/use-timezone";
import { blockPhase, durationLabel, formatTimeRange } from "@/lib/calendar";
import type { CalendarBlock } from "@/lib/types/calendar";
import { cn } from "@/lib/utils";

const kindLabel: Record<CalendarBlock["kind"], string> = {
  task: "task block",
  habit: "habit",
  event: "calendar",
};

function AgendaRow({
  block,
  now,
  timeZone,
}: {
  block: CalendarBlock;
  now: Date;
  timeZone: string;
}) {
  const remove = useRemoveBlock();
  const phase = blockPhase(block, now);
  const missed = block.status === "missed";

  return (
    <li
      className={cn(
        "group relative flex items-center gap-3 py-2 pr-2 pl-4",
        phase === "past" && "text-muted-foreground",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-2 bottom-2 left-0 w-0.5 rounded-full",
          phase === "now" ? "bg-primary" : block.fixed ? "bg-border-strong" : "bg-primary/30",
        )}
      />
      <time
        dateTime={block.starts_at}
        className={cn(
          "w-24 shrink-0 font-mono text-[0.6875rem] tabular-nums",
          phase === "now" ? "text-primary" : "text-faint",
        )}
      >
        {formatTimeRange(block.starts_at, block.ends_at, timeZone)}
      </time>
      <span className={cn("min-w-0 flex-1 truncate text-sm", missed && "line-through")}>
        {block.task_id || block.habit_id ? (
          <Link
            href={block.task_id ? "/tasks" : "/habits"}
            className="outline-none hover:underline focus-visible:underline"
          >
            {block.title}
          </Link>
        ) : (
          block.title
        )}
        {block.recovers_id && (
          <span className="ml-2 font-mono text-[0.625rem] text-primary">recovery</span>
        )}
      </span>
      <span className="hidden shrink-0 font-mono text-[0.625rem] text-faint sm:inline">
        {missed ? "missed" : kindLabel[block.kind]}
        {block.sync === "pending" && " · not synced"}
        {block.sync === "failed" && <span className="text-destructive"> · sync failed</span>}
      </span>
      {block.fixed ? (
        <span className="inline-flex size-6 shrink-0 items-center justify-center">
          <Lock aria-hidden="true" className="size-3 text-faint" />
          <span className="sr-only">Fixed</span>
        </span>
      ) : (
        <button
          type="button"
          aria-label={`Remove block for ${block.title}`}
          disabled={remove.isPending}
          onClick={() => remove.mutate(block.id)}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-faint opacity-100 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </li>
  );
}

/** Today's blocks. Google Calendar events join them once the calendar is connected. */
export function AgendaPanel() {
  const blocks = useCalendarBlocks();
  const status = useCalendarStatus();
  const now = useNow();
  const timeZone = useTimezone();

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      aria-labelledby="agenda-heading"
      className="rounded-xl border border-border bg-card/80"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <h2 id="agenda-heading" className="micro-label shrink-0">
          Today&apos;s agenda
        </h2>
        {status.data && !status.data.connected && (
          <span className="text-right font-mono text-[0.625rem] text-faint">
            <span className="hidden sm:inline">google </span>calendar not connected
            {status.data.pending > 0 && (
              <span className="hidden sm:inline"> · {status.data.pending} waiting to sync</span>
            )}
          </span>
        )}
      </div>
      {blocks.isPending || !now || !timeZone ? (
        <div className="space-y-2 px-4 py-3" aria-busy="true">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : blocks.isError ? (
        <p role="alert" className="px-4 py-4 text-sm text-muted-foreground">
          The agenda couldn&apos;t load: {blocks.error.message}.
        </p>
      ) : blocks.data.length === 0 && !status.data?.unbooked.length ? (
        <div className="flex items-center gap-3 px-4 py-4 text-sm text-muted-foreground">
          <CalendarClock aria-hidden="true" className="size-4 shrink-0 text-faint" />
          <p>
            Nothing scheduled today.{" "}
            <Link href="/tasks#plan" className="text-primary hover:underline">
              Plan your tasks
            </Link>{" "}
            into free time.
          </p>
        </div>
      ) : (
        <>
          <ol className="py-1">
            {blocks.data.map((block) => (
              <AgendaRow key={block.id} block={block} now={now} timeZone={timeZone} />
            ))}
          </ol>
          {status.data && status.data.unbooked.length > 0 && (
            <ul className="border-t border-border px-4 py-2.5 text-xs">
              {status.data.unbooked.map((item) => (
                <li key={item.habit_id} className="flex items-center gap-2 text-warning">
                  <span aria-hidden="true">●</span>
                  <span>
                    {item.title}: no free {durationLabel(item.minutes)} slot left today.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </motion.section>
  );
}
