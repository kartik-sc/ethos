import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed border-border-strong bg-card/50 px-6 py-10 sm:items-center sm:text-center">
      <span className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-background text-faint">
        <Icon className="size-[1.125rem]" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{children}</p>
      </div>
      {action}
    </div>
  );
}
