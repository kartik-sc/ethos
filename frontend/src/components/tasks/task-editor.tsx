"use client";

import { type FormEvent, type KeyboardEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { useProjects } from "@/hooks/use-projects";
import { useUpdateTask } from "@/hooks/use-tasks";
import { LIFE_AREAS, PRIORITIES } from "@/lib/tasks";
import type { LifeArea, Task, TaskPriority, TaskUpdate } from "@/lib/types/tasks";

import { fieldClass, labelClass } from "@/components/form-controls";

interface Draft {
  title: string;
  description: string;
  due_date: string;
  priority: TaskPriority;
  area: LifeArea | "";
  planned_minutes: string;
  project_id: string;
}

function toDraft(task: Task): Draft {
  return {
    title: task.title,
    description: task.description ?? "",
    due_date: task.due_date ?? "",
    priority: task.priority,
    area: task.area ?? "",
    planned_minutes: task.planned_minutes?.toString() ?? "",
    project_id: task.project_id ?? "",
  };
}

/** Only the fields that actually changed, in API shape. */
export function diffDraft(task: Task, draft: Draft): TaskUpdate {
  const next: TaskUpdate = {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    due_date: draft.due_date || null,
    priority: draft.priority,
    area: draft.area || null,
    planned_minutes: draft.planned_minutes ? Number(draft.planned_minutes) : null,
    project_id: draft.project_id || null,
  };
  return Object.fromEntries(
    Object.entries(next).filter(([key, value]) => task[key as keyof Task] !== value),
  ) as TaskUpdate;
}

interface TaskEditorProps {
  task: Task;
  onClose: () => void;
}

export function TaskEditor({ task, onClose }: TaskEditorProps) {
  const update = useUpdateTask();
  const projects = useProjects();
  const [draft, setDraft] = useState(() => toDraft(task));
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const changes = diffDraft(task, draft);
  const canSave = draft.title.trim().length > 0 && Object.keys(changes).length > 0;

  function save(event?: FormEvent) {
    event?.preventDefault();
    if (!canSave || update.isPending) return;
    update.mutate({ id: task.id, changes }, { onSuccess: onClose });
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) save();
  }

  return (
    <form
      onSubmit={save}
      onKeyDown={onKeyDown}
      aria-label={`Edit ${task.title}`}
      className="flex flex-col gap-3 border-t border-border bg-background/40 px-4 py-4 sm:pl-11"
    >
      <label className={labelClass}>
        Title
        <input
          autoFocus
          required
          maxLength={200}
          value={draft.title}
          onChange={(event) => set("title", event.target.value)}
          className={fieldClass}
        />
      </label>

      <label className={labelClass}>
        Notes
        <textarea
          rows={3}
          maxLength={5000}
          value={draft.description}
          onChange={(event) => set("description", event.target.value)}
          placeholder="Optional details"
          className={`${fieldClass} h-auto resize-y py-2 leading-relaxed`}
        />
      </label>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <label className={`${labelClass} col-span-2 sm:col-span-1`}>
          Project
          <select
            value={draft.project_id}
            onChange={(event) => set("project_id", event.target.value)}
            className={fieldClass}
          >
            <option value="">None</option>
            {task.project && !projects.data?.some((project) => project.id === task.project_id) && (
              <option value={task.project.id}>{task.project.title}</option>
            )}
            {projects.data?.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Due
          <input
            type="date"
            value={draft.due_date}
            onChange={(event) => set("due_date", event.target.value)}
            className={`${fieldClass} font-mono text-xs`}
          />
        </label>
        <label className={labelClass}>
          Priority
          <select
            value={draft.priority}
            onChange={(event) => set("priority", event.target.value as TaskPriority)}
            className={fieldClass}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority[0].toUpperCase() + priority.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Area
          <select
            value={draft.area}
            onChange={(event) => set("area", event.target.value as LifeArea | "")}
            className={fieldClass}
          >
            <option value="">None</option>
            {LIFE_AREAS.map((area) => (
              <option key={area.value} value={area.value}>
                {area.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Planned minutes
          <input
            type="number"
            inputMode="numeric"
            min={5}
            max={720}
            step={5}
            value={draft.planned_minutes}
            onChange={(event) => set("planned_minutes", event.target.value)}
            placeholder="—"
            className={`${fieldClass} font-mono text-xs`}
          />
        </label>
      </div>

      {update.isError && (
        <p role="alert" className="text-xs text-destructive">
          Couldn&apos;t save: {update.error.message}. Your edits are still here.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled={update.isPending}
          onClick={() => update.mutate({ id: task.id, changes: { status: "cancelled" } })}
        >
          Mark as cancelled
        </Button>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[0.6875rem] text-faint sm:inline">
            esc to close · ctrl+enter to save
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button type="submit" size="sm" disabled={!canSave || update.isPending}>
            Save
          </Button>
        </div>
      </div>
    </form>
  );
}
