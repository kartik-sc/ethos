"use client";

import { FolderX, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { fieldClass, labelClass } from "@/components/form-controls";
import { GoalSelect } from "@/components/goals/goal-select";
import { TaskBoard } from "@/components/tasks/task-board";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject, useTrashProject, useUpdateProject } from "@/hooks/use-projects";
import { useToday } from "@/hooks/use-today";
import { ApiError } from "@/lib/api";
import { taskSummary } from "@/lib/projects";
import { areaLabel, describeDue, LIFE_AREAS } from "@/lib/tasks";
import type { Project, ProjectUpdate } from "@/lib/types/projects";
import type { LifeArea } from "@/lib/types/tasks";
import { cn } from "@/lib/utils";

import { ProjectFiles } from "./project-files";
import { ProjectProgress } from "./project-progress";

function ProjectEditor({ project, onClose }: { project: Project; onClose: () => void }) {
  const update = useUpdateProject();
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? "");
  const [area, setArea] = useState<LifeArea | "">(project.area ?? "");
  const [dueDate, setDueDate] = useState(project.due_date ?? "");
  const [goalId, setGoalId] = useState(project.goal?.id ?? "");

  function save(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const changes: ProjectUpdate = {
      title: title.trim(),
      description: description.trim() || null,
      area: area || null,
      due_date: dueDate || null,
      ...((goalId || null) !== (project.goal?.id ?? null) && { goal_id: goalId || null }),
    };
    update.mutate({ id: project.id, changes }, { onSuccess: onClose });
  }

  return (
    <form
      onSubmit={save}
      onKeyDown={(event) => event.key === "Escape" && onClose()}
      aria-label="Edit project"
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
        Description
        <textarea
          rows={3}
          maxLength={5000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What is this project for?"
          className={`${fieldClass} h-auto resize-y py-2 leading-relaxed`}
        />
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <GoalSelect
          value={goalId}
          onChange={setGoalId}
          current={project.goal}
          className={`${labelClass} col-span-2 sm:col-span-1`}
        />
        <label className={labelClass}>
          Deadline
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
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

function DeleteProject({ project }: { project: Project }) {
  const router = useRouter();
  const trash = useTrashProject(() => router.push("/projects"));
  const [confirming, setConfirming] = useState(false);
  const liveTasks = project.tasks.open + project.tasks.done;

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
        Move to Trash{liveTasks > 0 && ` with its ${liveTasks} task${liveTasks === 1 ? "" : "s"}`}?
      </span>
      <Button variant="ghost" size="xs" onClick={() => setConfirming(false)}>
        Keep
      </Button>
      <Button
        variant="destructive"
        size="xs"
        disabled={trash.isPending}
        onClick={() => trash.mutate(project.id)}
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

export function ProjectDetail({ id }: { id: string }) {
  const project = useProject(id);
  const today = useToday();
  const [editing, setEditing] = useState(false);

  if (project.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <BackLink href="/projects" label="projects" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <Skeleton className="h-1 w-full" />
      </div>
    );
  }

  if (project.isError) {
    const missing = project.error instanceof ApiError && project.error.status === 404;
    return (
      <div className="flex flex-col gap-6">
        <BackLink href="/projects" label="projects" />
        <EmptyState
          icon={FolderX}
          title={missing ? "Project not found" : "Project couldn't load"}
          action={
            missing ? undefined : (
              <Button size="sm" variant="outline" onClick={() => void project.refetch()}>
                Try again
              </Button>
            )
          }
        >
          {missing
            ? "It may be in Trash. Restore it from the Projects page to work on it again."
            : project.error.message}
        </EmptyState>
      </div>
    );
  }

  const data = project.data;
  const due = data.due_date && today ? describeDue(data.due_date, today) : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <BackLink href="/projects" label="projects" />
        {editing ? (
          <ProjectEditor project={data} onClose={() => setEditing(false)} />
        ) : (
          <header className="flex flex-col gap-4 border-b border-border pb-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <h1 className="text-2xl font-medium tracking-[-0.015em] break-words">
                  {data.title}
                </h1>
                {data.description && (
                  <p className="max-w-prose text-sm whitespace-pre-line text-muted-foreground">
                    {data.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" />
                  Edit
                </Button>
                <DeleteProject project={data} />
              </div>
            </div>
            <ProjectProgress project={data} />
            <p className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.6875rem] text-faint">
              <span>{taskSummary(data)}</span>
              {due && (
                <span className={cn(due.tone === "overdue" && "text-destructive")}>
                  deadline {due.text.toLowerCase()}
                </span>
              )}
              {data.area && <span>{areaLabel(data.area).toLowerCase()}</span>}
            </p>
          </header>
        )}
      </div>
      <TaskBoard scope={{ projectId: data.id }} />
      <ProjectFiles projectId={data.id} />
    </div>
  );
}
