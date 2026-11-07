"use client";

import { CalendarDays, Flag, LoaderCircle } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";

import { type TaskScope, useCreateTask } from "@/hooks/use-tasks";
import type { TaskPriority } from "@/lib/types/tasks";
import { cn } from "@/lib/utils";

const nextPriority: Record<TaskPriority, TaskPriority> = {
  normal: "high",
  high: "low",
  low: "normal",
};

const priorityText: Record<TaskPriority, string> = {
  high: "text-primary",
  normal: "text-faint",
  low: "text-faint/60",
};

export function QuickAdd({ scope = {} }: { scope?: TaskScope }) {
  const create = useCreateTask();
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || create.isPending) return;
    create.mutate(
      {
        title: trimmed,
        priority,
        due_date: dueDate || null,
        project_id: scope.projectId ?? null,
        goal_id: scope.goalId ?? null,
      },
      {
        onSuccess: () => {
          setTitle("");
          setDueDate("");
          setPriority("normal");
          titleRef.current?.focus();
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-border bg-card/80 py-1.5 pr-1.5 pl-3.5 transition-colors",
          "focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/25",
        )}
      >
        <span aria-hidden="true" className="font-mono text-sm text-primary select-none">
          ›
        </span>
        <label htmlFor="quick-add-title" className="sr-only">
          New task
        </label>
        <input
          id="quick-add-title"
          ref={titleRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          autoComplete="off"
          placeholder="Add a task and press Enter"
          className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
        />

        <label
          className={cn(
            "relative inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 font-mono text-[0.6875rem] transition-colors",
            "focus-within:ring-2 focus-within:ring-ring hover:bg-accent",
            dueDate ? "text-foreground" : "text-faint",
          )}
        >
          <CalendarDays aria-hidden="true" className="size-3.5" />
          <span className="sr-only">Due date</span>
          <input
            type="date"
            onClick={(event) => event.currentTarget.showPicker?.()}
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className={cn(
              "bg-transparent outline-none [&::-webkit-calendar-picker-indicator]:hidden",
              dueDate ? "w-[6.75rem]" : "w-0 sm:w-[6.75rem]",
            )}
          />
        </label>

        <button
          type="button"
          onClick={() => setPriority(nextPriority[priority])}
          aria-label={`Priority: ${priority}. Change priority`}
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 font-mono text-[0.6875rem] transition-colors outline-none",
            "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
            priorityText[priority],
          )}
        >
          <Flag
            aria-hidden="true"
            className="size-3.5"
            fill={priority === "high" ? "currentColor" : "none"}
          />
          <span className="hidden sm:inline">{priority}</span>
        </button>

        <button
          type="submit"
          disabled={!title.trim() || create.isPending}
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
          )}
        >
          {create.isPending && (
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
          )}
          Add
        </button>
      </div>
      {create.isError && (
        <p role="alert" className="px-1 text-xs text-destructive">
          Couldn&apos;t add the task: {create.error.message}. Your text is still here.
        </p>
      )}
    </form>
  );
}
