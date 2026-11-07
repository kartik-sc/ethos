"use client";

import { Pencil, Target, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { fieldClass, labelClass } from "@/components/form-controls";
import { ProjectProgress } from "@/components/projects/project-progress";
import { TaskBoard } from "@/components/tasks/task-board";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGoal, useTrashGoal, useUpdateGoal } from "@/hooks/use-goals";
import { useProjects, useUpdateProject } from "@/hooks/use-projects";
import { useToday } from "@/hooks/use-today";
import { ApiError } from "@/lib/api";
import { goalRatio, goalSummary } from "@/lib/goals";
import { taskSummary } from "@/lib/projects";
import { areaLabel, describeDue, LIFE_AREAS } from "@/lib/tasks";
import type { Goal, GoalUpdate } from "@/lib/types/goals";
import type { LifeArea } from "@/lib/types/tasks";
import { cn } from "@/lib/utils";

import { ProgressRing } from "./progress-ring";

function GoalEditor({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const update = useUpdateGoal();
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description ?? "");
  const [area, setArea] = useState<LifeArea | "">(goal.area ?? "");
  const [targetDate, setTargetDate] = useState(goal.target_date ?? "");

  function save(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const changes: GoalUpdate = {
      title: title.trim(),
      description: description.trim() || null,
      area: area || null,
      target_date: targetDate || null,
    };
    update.mutate({ id: goal.id, changes }, { onSuccess: onClose });
  }

  return (
    <form
      onSubmit={save}
      onKeyDown={(event) => event.key === "Escape" && onClose()}
      aria-label="Edit goal"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card/80 p-4"
    >
      <label className={labelClass}>
        Title
        <input
          autoFocus
          required
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className={fieldClass}
        />
      </label>
      <label className={labelClass}>
        Why it matters
        <textarea
          rows={3}
          maxLength={5000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Optional"
          className={`${fieldClass} h-auto resize-y py-2 leading-relaxed`}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={labelClass}>
          Target date
          <input
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
            className={`${fieldClass} font-mono text-xs`}
          />
        </label>
        <label className={labelClass}>
          Area
          <select
            value={area}
            onChange={(event) => setArea(event.target.value as LifeArea | "")}
            className={fieldClass}
          >
            <option value="">None</option>
            {LIFE_AREAS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {update.isError && (
        <p role="alert" className="text-xs text-destructive">
          Couldn&apos;t save: {update.error.message}. Your edits are still here.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button type="submit" size="sm" disabled={!title.trim() || update.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}

function DeleteGoal({ goal }: { goal: Goal }) {
  const router = useRouter();
  const trash = useTrashGoal(() => router.push("/goals"));
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setConfirming(true)}
      >
        <Trash2 aria-hidden="true" />
        Delete
      </Button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Confirm delete"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 py-1 pr-1 pl-3 text-xs"
    >
      <span className="text-muted-foreground">
        Move to Trash? Its projects and tasks stay where they are.
      </span>
      <Button variant="ghost" size="xs" onClick={() => setConfirming(false)}>
        Keep
      </Button>
      <Button
        variant="destructive"
        size="xs"
        disabled={trash.isPending}
        onClick={() => trash.mutate(goal.id)}
      >
        Move to Trash
      </Button>
      {trash.isError && (
        <span role="alert" className="text-destructive">
          {trash.error.message}
        </span>
      )}
    </div>
  );
}

function LinkedProjects({ goalId }: { goalId: string }) {
  const linked = useProjects("active", goalId);
  const all = useProjects("active");
  const update = useUpdateProject();
  const unlinked = (all.data ?? []).filter((project) => project.goal?.id !== goalId);

  return (
    <section aria-labelledby="goal-projects" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="goal-projects" className="micro-label px-1">
          Projects
        </h2>
        {unlinked.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="sr-only">Link a project</span>
            <select
              value=""
              disabled={update.isPending}
              onChange={(event) =>
                event.target.value &&
                update.mutate({ id: event.target.value, changes: { goal_id: goalId } })
              }
              className={cn(fieldClass, "h-7 w-auto text-xs")}
            >
              <option value="">Link a project…</option>
              {unlinked.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                  {project.goal ? ` (now: ${project.goal.title})` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {update.isError && (
        <p role="alert" className="px-1 text-xs text-destructive">
          Couldn&apos;t change the link: {update.error.message}.
        </p>
      )}

      {linked.isPending ? (
        <Skeleton className="h-14 w-full rounded-xl" />
      ) : linked.isError ? (
        <p className="px-1 text-xs text-destructive">
          Projects couldn&apos;t load: {linked.error.message}.
        </p>
      ) : linked.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong px-4 py-3 text-xs text-muted-foreground">
          No projects linked. Their tasks count toward this goal once linked.
        </p>
      ) : (
        <ul className="rounded-xl border border-border bg-card/80">
          {linked.data.map((project) => (
            <li
              key={project.id}
              className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
            >
              <Link
                href={`/projects/${project.id}`}
                className="flex min-w-0 flex-1 flex-col gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm hover:underline">{project.title}</span>
                  <span className="shrink-0 font-mono text-[0.6875rem] text-faint">
                    {taskSummary(project)}
                  </span>
                </span>
                <ProjectProgress project={project} />
              </Link>
              <button
                type="button"
                aria-label={`Unlink ${project.title}`}
                disabled={update.isPending}
                onClick={() => update.mutate({ id: project.id, changes: { goal_id: null } })}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-faint outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function GoalDetail({ id }: { id: string }) {
  const goal = useGoal(id);
  const today = useToday();
  const [editing, setEditing] = useState(false);

  if (goal.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <BackLink href="/goals" label="goals" />
        <div className="flex items-center gap-5">
          <Skeleton className="size-22 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
      </div>
    );
  }

  if (goal.isError) {
    const missing = goal.error instanceof ApiError && goal.error.status === 404;
    return (
      <div className="flex flex-col gap-6">
        <BackLink href="/goals" label="goals" />
        <EmptyState
          icon={Target}
          title={missing ? "Goal not found" : "Goal couldn't load"}
          action={
            missing ? undefined : (
              <Button size="sm" variant="outline" onClick={() => void goal.refetch()}>
                Try again
              </Button>
            )
          }
        >
          {missing ? "It may be in Trash. Restore it from the Goals page." : goal.error.message}
        </EmptyState>
      </div>
    );
  }

  const data = goal.data;
  const target = data.target_date && today ? describeDue(data.target_date, today) : null;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-5">
        <BackLink href="/goals" label="goals" />
        {editing ? (
          <GoalEditor goal={data} onClose={() => setEditing(false)} />
        ) : (
          <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-center">
            <ProgressRing ratio={goalRatio(data.progress)} size={88} stroke={5} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="text-2xl font-medium tracking-[-0.015em] break-words">
                  {data.title}
                </h1>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                    <Pencil aria-hidden="true" />
                    Edit
                  </Button>
                  <DeleteGoal goal={data} />
                </div>
              </div>
              {data.description && (
                <p className="max-w-prose text-sm whitespace-pre-line text-muted-foreground">
                  {data.description}
                </p>
              )}
              <p className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.6875rem] text-faint">
                <span>{goalSummary(data.progress)}</span>
                {target && (
                  <span className={cn(target.tone === "overdue" && "text-destructive")}>
                    target {target.text.toLowerCase()}
                  </span>
                )}
                {data.area && <span>{areaLabel(data.area).toLowerCase()}</span>}
              </p>
            </div>
          </header>
        )}
      </div>

      <LinkedProjects goalId={data.id} />

      <section aria-labelledby="goal-tasks" className="flex flex-col gap-3">
        <h2 id="goal-tasks" className="micro-label px-1">
          Tasks linked directly
        </h2>
        <TaskBoard scope={{ goalId: data.id }} />
      </section>
    </div>
  );
}
