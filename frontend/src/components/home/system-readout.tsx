"use client";

import { motion } from "motion/react";

import { StatusDot } from "@/components/system/status-dot";
import { useHealth } from "@/hooks/use-health";
import { useNow } from "@/hooks/use-now";
import { type SignalTone, summariseSystem } from "@/lib/system-status";
import { formatRelativeSeconds } from "@/lib/time";
import { cn } from "@/lib/utils";

const toneWord: Record<SignalTone, string> = {
  ok: "Nominal",
  degraded: "Degraded",
  down: "Down",
  pending: "—",
};

const toneText: Record<SignalTone, string> = {
  ok: "text-foreground",
  degraded: "text-warning",
  down: "text-destructive",
  pending: "text-faint",
};

export function SystemReadout() {
  const health = useHealth();
  const summary = summariseSystem(health);
  const now = useNow();

  return (
    <motion.section
      aria-labelledby="system-heading"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border border-border bg-card/80 backdrop-blur-[2px]"
    >
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-2.5">
        <h2 id="system-heading" className="micro-label">
          System
        </h2>
        <p className="font-mono text-[0.6875rem] text-faint" aria-live="polite">
          {health.isFetching && !health.data
            ? "checking…"
            : health.dataUpdatedAt > 0 && now
              ? `checked ${formatRelativeSeconds(new Date(health.dataUpdatedAt), now)}`
              : summary.label.toLowerCase()}
        </p>
      </div>

      <dl className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {summary.signals.map((signal) => (
          <div key={signal.name} className="flex flex-col gap-1.5 px-4 py-3.5">
            <dt className="flex items-center gap-2 text-xs text-muted-foreground">
              <StatusDot tone={signal.tone} />
              {signal.name}
            </dt>
            <dd className="flex items-baseline justify-between gap-3">
              <span className={cn("text-sm font-medium", toneText[signal.tone])}>
                {toneWord[signal.tone]}
              </span>
              <span className="truncate font-mono text-[0.6875rem] text-faint">
                {signal.detail}
              </span>
            </dd>
          </div>
        ))}
      </dl>

      {health.isError && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span>The Ethos API is not reachable. Checking again every 30 seconds.</span>
          <button
            type="button"
            onClick={() => void health.refetch()}
            className="shrink-0 rounded-md px-2 py-1 font-medium text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            Retry now
          </button>
        </div>
      )}
    </motion.section>
  );
}
