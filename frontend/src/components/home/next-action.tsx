"use client";

import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNextAction, useOverrideNextAction, useTasks, useUpdateTask } from "@/hooks/use-tasks";
import { useToday } from "@/hooks/use-today";
import { areaLabel, describeDue, formatMinutes } from "@/lib/tasks";
import type { Task } from "@/lib/types/tasks";
import { cn } from "@/lib/utils";

const PICKER_LIMIT = 8;

function Alternatives({
  currentId,
  onPick,
  disabled,
}: {
  currentId: string;
  onPick: (task: Task) => void;
  disabled: boolean;
}) {
  const open = useTasks("open");
  const others = (open.data ?? []).filter((task) => task.id !== currentId).slice(0, PICKER_LIMIT);

  if (open.isPending) return <Skeleton className="mx-4 my-3 h-4 w-48" />;
  if (others.length === 0) {
    return <p className="px-4 py-3 text-xs text-muted-foreground">No other open tasks.</p>;
  }
  return (
    <ul aria-label="Other open tasks" className="py-1">
      {others.map((task) => (
        <li key={task.id}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(task)}
            className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground disabled:opacity-50"
          >
            <span className="truncate">{task.title}</span>
            <ArrowRight aria-hidden="true" className="size-3.5 shrink-0 text-faint" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function NextActionPanel() {
  const next = useNextAction();
  const today = useToday();
  const complete = useUpdateTask();
  const override = useOverrideNextAction();
  const [picking, setPicking] = useState(false);

  const task = next.data?.task ?? null;
  const due = task?.due_date && today ? describeDue(task.due_date, today) : null;

  return (
    <motion.section
      aria-labelledby="next-action-heading"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-xl border border-border bg-card/80 backdrop-blur-[2px]"
    >
      {task && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-primary" />}

      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-2.5">
        <h2 id="next-action-heading" className="micro-label">
          Next action
        </h2>
        {next.data?.reason && (
          <span
            className={cn(
              "font-mono text-[0.6875rem]",
              due?.tone === "overdue" && !next.data.overridden
                ? "text-destructive"
                : "text-primary",
            )}
          >
            {next.data.reason.toLowerCase()}
          </span>
        )}
      </div>

      {next.isPending ? (
        <div className="space-y-2.5 px-4 py-4" aria-busy="true">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-40" />
        </div>
      ) : next.isError ? (
        <div className="flex items-center justify-between gap-3 px-4 py-4 text-sm text-muted-foreground">
          <span>Tasks are unavailable: {next.error.message}.</span>
          <button
            type="button"
            onClick={() => void next.refetch()}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            Retry
          </button>
        </div>
      ) : task === null ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <p className="text-sm text-muted-foreground">
            Nothing open. Your next task shows up here.
          </p>
          <Button size="sm" variant="outline" render={<Link href="/tasks" />}>
            Add a task
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1.5">
              <p className="text-lg leading-snug font-medium tracking-[-0.01em] break-words">
                {task.title}
              </p>
              <p className="flex flex-wrap gap-x-3 font-mono text-[0.6875rem] text-faint">
                {due && (
                  <span>
                    {due.tone === "overdue"
                      ? due.text.toLowerCase()
                      : `due ${due.text.toLowerCase()}`}
                  </span>
                )}
                {task.priority !== "normal" && <span>{task.priority} priority</span>}
                {task.area && <span>{areaLabel(task.area).toLowerCase()}</span>}
                {task.planned_minutes !== null && (
                  <span>{formatMinutes(task.planned_minutes)}</span>
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                aria-expanded={picking}
                onClick={() => setPicking((value) => !value)}
              >
                Pick another
                <ChevronDown
                  aria-hidden="true"
                  className={cn("transition-transform", picking && "rotate-180")}
                />
              </Button>
              <Button
                size="sm"
                disabled={complete.isPending}
                onClick={() => complete.mutate({ id: task.id, changes: { status: "done" } })}
              >
                <Check aria-hidden="true" />
                Done
              </Button>
            </div>
          </div>

          {(complete.isError || override.isError) && (
            <p role="alert" className="px-4 pb-3 text-xs text-destructive">
              Couldn&apos;t save: {(complete.error ?? override.error)?.message}.
            </p>
          )}

          <AnimatePresence initial={false}>
            {picking && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden border-t border-border"
              >
                <Alternatives
                  currentId={task.id}
                  disabled={override.isPending}
                  onPick={(chosen) =>
                    override.mutate(
                      { suggestedId: task.id, chosenId: chosen.id },
                      { onSuccess: () => setPicking(false) },
                    )
                  }
                />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.section>
  );
}
