"use client";

import { CheckCheck, ListTodo, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { ViewTabs } from "@/components/view-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useRestoreTask, useTasks, useTrashTask } from "@/hooks/use-tasks";
import { useToday } from "@/hooks/use-today";
import { groupOpenTasks, type TaskSection } from "@/lib/tasks";
import type { Task, TaskView } from "@/lib/types/tasks";
import { cn } from "@/lib/utils";

import { QuickAdd } from "./quick-add";
import { TaskRow } from "./task-row";

const UNDO_MS = 6000;

const views: { value: TaskView; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "done", label: "Done" },
  { value: "trash", label: "Trash" },
];

const empty: Record<TaskView, { icon: typeof ListTodo; title: string; body: string }> = {
  open: {
    icon: ListTodo,
    title: "Nothing open",
    body: "Add a task above. Deadlines and priority decide what Home highlights next.",
  },
  done: {
    icon: CheckCheck,
    title: "Nothing finished yet",
    body: "Completed and cancelled tasks appear here, most recent first.",
  },
  trash: {
    icon: Trash2,
    title: "Trash is empty",
    body: "Deleted tasks land here and can be restored.",
  },
};

function LoadingRows() {
  return (
    <div className="divide-y divide-border" aria-hidden="true">
      {[68, 52, 76, 44].map((width) => (
        <div key={width} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-4.5 rounded-full" />
          <Skeleton className="h-3.5" style={{ width: `${width}%` }} />
        </div>
      ))}
    </div>
  );
}

interface UndoState {
  task: Task;
  timer: ReturnType<typeof setTimeout>;
}

export function TaskBoard({ projectId }: { projectId?: string }) {
  const [view, setView] = useState<TaskView>("open");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const tasks = useTasks(view, projectId);
  const today = useToday();
  const trash = useTrashTask();
  const restore = useRestoreTask();

  useEffect(() => () => clearTimeout(undo?.timer), [undo]);

  function moveToTrash(task: Task) {
    setUndo({ task, timer: setTimeout(() => setUndo(null), UNDO_MS) });
    trash.mutate(task.id, { onError: () => setUndo(null) });
  }

  function undoTrash() {
    if (!undo) return;
    restore.mutate(undo.task.id);
    setUndo(null);
  }

  const emptyCopy =
    projectId && view === "open"
      ? {
          ...empty.open,
          title: "No open tasks here",
          body: "Tasks added above belong to this project.",
        }
      : empty[view];

  const sections: TaskSection[] =
    tasks.data && today
      ? view === "open"
        ? groupOpenTasks(tasks.data, today)
        : [{ key: "undated", label: "", tasks: tasks.data }]
      : [];

  return (
    <div className="flex flex-col gap-6">
      <QuickAdd projectId={projectId} />

      <div className="flex items-center justify-between gap-3">
        <ViewTabs
          label="Task views"
          views={views}
          value={view}
          onChange={(next) => {
            setView(next);
            setExpandedId(null);
          }}
        />
        {tasks.data && (
          <span className="font-mono text-[0.6875rem] text-faint" aria-live="polite">
            {tasks.data.length} {view === "trash" ? "deleted" : view}
          </span>
        )}
      </div>

      {tasks.isPending || (tasks.data && !today) ? (
        <div className="rounded-xl border border-border bg-card/80">
          <LoadingRows />
        </div>
      ) : tasks.isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
        >
          <span className="text-muted-foreground">
            Tasks couldn&apos;t load: {tasks.error.message}.
          </span>
          <button
            type="button"
            onClick={() => void tasks.refetch()}
            className="rounded-md px-2 py-1 text-xs font-medium text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            Try again
          </button>
        </div>
      ) : sections.length === 0 || sections.every((section) => section.tasks.length === 0) ? (
        <EmptyState icon={emptyCopy.icon} title={emptyCopy.title}>
          {emptyCopy.body}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-5">
          {sections.map((section) => (
            <section key={section.key} aria-label={section.label || undefined}>
              {section.label && (
                <h2
                  className={cn(
                    "micro-label mb-2 flex items-center gap-2 px-1",
                    section.key === "overdue" && "text-destructive",
                  )}
                >
                  {section.label}
                  <span className="text-faint">{section.tasks.length}</span>
                </h2>
              )}
              <ul className="rounded-xl border border-border bg-card/80">
                <AnimatePresence initial={false}>
                  {section.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      view={view}
                      today={today ?? ""}
                      expanded={expandedId === task.id}
                      onExpandedChange={(open) => setExpandedId(open ? task.id : null)}
                      onTrash={moveToTrash}
                      showProject={!projectId}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          ))}
        </div>
      )}

      {trash.isError && (
        <p role="alert" className="text-xs text-destructive">
          Couldn&apos;t move the task to Trash: {trash.error.message}.
        </p>
      )}

      <AnimatePresence>
        {undo && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg border border-border-strong bg-popover px-4 py-2.5 text-sm shadow-lg md:bottom-6"
          >
            <span className="min-w-0 truncate text-muted-foreground">
              Moved <span className="text-foreground">{undo.task.title}</span> to Trash
            </span>
            <button
              type="button"
              onClick={undoTrash}
              disabled={trash.isPending}
              className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
