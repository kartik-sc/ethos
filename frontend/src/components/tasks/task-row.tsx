"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { motion } from "motion/react";

import { useNow } from "@/hooks/use-now";
import { useRestoreTask, useUpdateTask } from "@/hooks/use-tasks";
import { areaLabel, type DueTone, describeDue, formatMinutes } from "@/lib/tasks";
import { formatRelativeSeconds } from "@/lib/time";
import { trashLabel } from "@/lib/trash";
import type { Task, TaskView } from "@/lib/types/tasks";
import { cn } from "@/lib/utils";

import { TaskCheck } from "./task-check";
import { TaskEditor } from "./task-editor";

const dueTone: Record<DueTone, string> = {
  overdue: "text-destructive",
  soon: "text-primary",
  later: "text-muted-foreground",
};

interface TaskRowProps {
  task: Task;
  view: TaskView;
  today: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onTrash: (task: Task) => void;
  showProject: boolean;
}

function Meta({
  task,
  view,
  today,
  showProject,
}: Pick<TaskRowProps, "task" | "view" | "today" | "showProject">) {
  const now = useNow();
  const due = task.due_date ? describeDue(task.due_date, today) : null;
  const closedAt = view === "trash" ? task.deleted_at : (task.completed_at ?? task.cancelled_at);

  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.6875rem] text-faint">
      {showProject && task.project && (
        <span className="max-w-40 truncate text-muted-foreground">{task.project.title}</span>
      )}
      {task.area && <span>{areaLabel(task.area).toLowerCase()}</span>}
      {task.planned_minutes !== null && <span>{formatMinutes(task.planned_minutes)}</span>}
      {view === "open" && due && <span className={dueTone[due.tone]}>{due.text}</span>}
      {view !== "open" && closedAt && now && (
        <span>
          {view === "trash"
            ? trashLabel(closedAt, now)
            : `${task.status} ${formatRelativeSeconds(new Date(closedAt), now)}`}
        </span>
      )}
    </span>
  );
}

export function TaskRow({
  task,
  view,
  today,
  expanded,
  onExpandedChange,
  onTrash,
  showProject,
}: TaskRowProps) {
  const update = useUpdateTask();
  const restore = useRestoreTask();
  const closed = task.status !== "open";

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
      className="group overflow-hidden border-b border-border last:border-b-0"
    >
      <div className="flex items-start gap-3 px-4 py-2.5">
        {view !== "trash" && (
          <span className="pt-0.5">
            <TaskCheck
              checked={closed}
              priority={task.priority}
              label={closed ? `Reopen ${task.title}` : `Complete ${task.title}`}
              disabled={update.isPending}
              onToggle={() =>
                update.mutate({ id: task.id, changes: { status: closed ? "open" : "done" } })
              }
            />
          </span>
        )}

        <button
          type="button"
          disabled={view === "trash"}
          aria-expanded={view === "trash" ? undefined : expanded}
          onClick={() => onExpandedChange(!expanded)}
          className="flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        >
          <span
            className={cn(
              "min-w-0 text-sm break-words",
              closed || view === "trash"
                ? "text-muted-foreground"
                : "text-foreground group-hover:text-foreground",
              task.status === "done" && "line-through decoration-faint",
            )}
          >
            {task.priority === "high" && view === "open" && (
              <span className="mr-1.5 font-mono text-xs text-primary" aria-label="High priority">
                !
              </span>
            )}
            {task.title}
          </span>
          <Meta task={task} view={view} today={today} showProject={showProject} />
        </button>

        {view === "trash" ? (
          <button
            type="button"
            onClick={() => restore.mutate(task.id)}
            disabled={restore.isPending}
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
            Restore
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onTrash(task)}
            aria-label={`Move ${task.title} to Trash`}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-faint opacity-100 transition-opacity outline-none hover:bg-accent hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring sm:opacity-0 sm:group-hover:opacity-100"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
          </button>
        )}
      </div>

      {(update.isError || restore.isError) && !expanded && (
        <p role="alert" className="px-4 pb-2.5 text-xs text-destructive sm:pl-11">
          Couldn&apos;t update this task: {(update.error ?? restore.error)?.message}.
        </p>
      )}

      {expanded && view !== "trash" && (
        <TaskEditor task={task} onClose={() => onExpandedChange(false)} />
      )}
    </motion.li>
  );
}
