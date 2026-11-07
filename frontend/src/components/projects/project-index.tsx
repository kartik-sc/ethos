"use client";

import { FolderKanban, RotateCcw, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { QuickCreate } from "@/components/quick-create";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewTabs } from "@/components/view-tabs";
import { useNow } from "@/hooks/use-now";
import { useCreateProject, useProjects, useRestoreProject } from "@/hooks/use-projects";
import { useToday } from "@/hooks/use-today";
import { taskSummary } from "@/lib/projects";
import { areaLabel, describeDue } from "@/lib/tasks";
import { formatRelativeSeconds } from "@/lib/time";
import type { Project, ProjectView } from "@/lib/types/projects";
import { cn } from "@/lib/utils";

import { ProjectProgress } from "./project-progress";

const views = [
  { value: "active", label: "Active" },
  { value: "trash", label: "Trash" },
] as const;

function NewProject() {
  const create = useCreateProject();
  return (
    <QuickCreate
      id="new-project-title"
      label="New project"
      placeholder="Name a new project and press Enter"
      dateLabel="Project deadline"
      pending={create.isPending}
      error={create.error}
      onCreate={(title, dueDate, reset) =>
        create.mutate({ title, due_date: dueDate }, { onSuccess: reset })
      }
    />
  );
}

function ProjectCard({ project, today }: { project: Project; today: string | null }) {
  const due = project.due_date && today ? describeDue(project.due_date, today) : null;
  const nextTask =
    project.tasks.next_due && today ? describeDue(project.tasks.next_due, today) : null;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex flex-col gap-4 rounded-xl border border-border bg-card/80 p-4 transition-colors outline-none hover:border-border-strong hover:bg-card focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="truncate text-[0.9375rem] font-medium tracking-[-0.01em]">
            {project.title}
          </h2>
          <p className="line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">
            {project.description || <span className="text-faint">No description</span>}
          </p>
        </div>
        {due && (
          <span
            className={cn(
              "shrink-0 font-mono text-[0.6875rem]",
              due.tone === "overdue" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {due.tone === "overdue" ? due.text.toLowerCase() : `due ${due.text.toLowerCase()}`}
          </span>
        )}
      </div>
      <ProjectProgress project={project} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.6875rem] text-faint">
        <span>{taskSummary(project)}</span>
        {nextTask && <span>next task {nextTask.text.toLowerCase()}</span>}
        {project.area && <span className="ml-auto">{areaLabel(project.area).toLowerCase()}</span>}
      </div>
    </Link>
  );
}

function TrashRow({ project }: { project: Project }) {
  const restore = useRestoreProject();
  const now = useNow();

  return (
    <li className="flex flex-col gap-1 border-b border-border px-4 py-2.5 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{project.title}</p>
          {project.deleted_at && now && (
            <p className="font-mono text-[0.6875rem] text-faint">
              deleted {formatRelativeSeconds(new Date(project.deleted_at), now)} · its tasks come
              back with it
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => restore.mutate(project.id)}
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

export function ProjectIndex() {
  const [view, setView] = useState<ProjectView>("active");
  const projects = useProjects(view);
  const today = useToday();

  return (
    <div className="flex flex-col gap-6">
      <NewProject />

      <div className="flex items-center justify-between gap-3">
        <ViewTabs label="Project views" views={views} value={view} onChange={setView} />
        {projects.data && (
          <span className="font-mono text-[0.6875rem] text-faint" aria-live="polite">
            {projects.data.length} {view === "trash" ? "deleted" : "active"}
          </span>
        )}
      </div>

      {projects.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">
          {[0, 1].map((key) => (
            <div key={key} className="space-y-4 rounded-xl border border-border bg-card/80 p-4">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-1 w-full" />
            </div>
          ))}
        </div>
      ) : projects.isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
        >
          <span className="text-muted-foreground">
            Projects couldn&apos;t load: {projects.error.message}.
          </span>
          <button
            type="button"
            onClick={() => void projects.refetch()}
            className="rounded-md px-2 py-1 text-xs font-medium text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            Try again
          </button>
        </div>
      ) : projects.data.length === 0 ? (
        view === "active" ? (
          <EmptyState icon={FolderKanban} title="No projects yet">
            Name one above. A project is a simple home for related tasks and a deadline.
          </EmptyState>
        ) : (
          <EmptyState icon={Trash2} title="Trash is empty">
            Deleted projects land here with their tasks and can be restored together.
          </EmptyState>
        )
      ) : view === "active" ? (
        <motion.div layout className="grid gap-3 sm:grid-cols-2">
          {projects.data.map((project) => (
            <ProjectCard key={project.id} project={project} today={today} />
          ))}
        </motion.div>
      ) : (
        <ul className="rounded-xl border border-border bg-card/80">
          {projects.data.map((project) => (
            <TrashRow key={project.id} project={project} />
          ))}
        </ul>
      )}
    </div>
  );
}
