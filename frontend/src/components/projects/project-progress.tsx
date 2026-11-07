import { completionRatio } from "@/lib/projects";
import type { Project } from "@/lib/types/projects";

export function ProjectProgress({ project }: { project: Pick<Project, "tasks"> }) {
  const ratio = completionRatio(project);
  const percent = ratio === null ? 0 : Math.round(ratio * 100);

  return (
    <div
      role="progressbar"
      aria-label="Tasks done"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-1 w-full overflow-hidden rounded-full bg-muted"
    >
      {ratio !== null && (
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out-quint motion-reduce:transition-none"
          style={{ width: `${percent === 0 ? 0 : Math.max(percent, 2)}%` }}
        />
      )}
    </div>
  );
}
