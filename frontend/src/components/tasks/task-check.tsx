import { Check } from "lucide-react";

import type { TaskPriority } from "@/lib/types/tasks";
import { cn } from "@/lib/utils";

interface TaskCheckProps {
  checked: boolean;
  priority: TaskPriority;
  label: string;
  disabled?: boolean;
  onToggle: () => void;
}

export function TaskCheck({ checked, priority, label, disabled, onToggle }: TaskCheckProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "group/check relative inline-flex size-4.5 shrink-0 items-center justify-center rounded-full border transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : priority === "high"
            ? "border-primary/80 hover:bg-primary/15"
            : "border-border-strong hover:border-primary/60 hover:bg-primary/10",
      )}
    >
      <Check
        aria-hidden="true"
        strokeWidth={3}
        className={cn(
          "size-2.5 transition-opacity",
          checked ? "opacity-100" : "opacity-0 group-hover/check:opacity-60",
        )}
      />
    </button>
  );
}
