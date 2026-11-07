import type { SignalTone } from "@/lib/system-status";
import { cn } from "@/lib/utils";

const toneClass: Record<SignalTone, string> = {
  ok: "bg-success",
  degraded: "bg-warning",
  down: "bg-destructive",
  pending: "bg-faint",
};

export function StatusDot({ tone, className }: { tone: SignalTone; className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2 shrink-0", className)} aria-hidden="true">
      {tone !== "ok" && tone !== "pending" && (
        <span
          className={cn(
            "absolute inset-0 animate-ping rounded-full opacity-50 motion-reduce:animate-none",
            toneClass[tone],
          )}
        />
      )}
      <span className={cn("relative size-2 rounded-full", toneClass[tone])} />
    </span>
  );
}
