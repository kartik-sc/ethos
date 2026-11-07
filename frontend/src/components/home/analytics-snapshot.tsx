"use client";

import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

import { Skeleton } from "@/components/ui/skeleton";
import { useAnalytics } from "@/hooks/use-analytics";
import { delta, percent } from "@/lib/analytics";

/** Home's analytics snapshot: this week in three numbers, with the full view one click away. */
export function AnalyticsSnapshot() {
  const analytics = useAnalytics("week", 0);
  const report = analytics.data;

  return (
    <motion.section
      aria-labelledby="snapshot-heading"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border border-border bg-card/80"
    >
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-2.5">
        <h2 id="snapshot-heading" className="micro-label">
          This week
        </h2>
        <Link
          href="/analytics"
          className="flex items-center gap-1 font-mono text-[0.6875rem] text-primary hover:underline"
        >
          analytics <ArrowRight aria-hidden="true" className="size-3" />
        </Link>
      </div>
      {analytics.isPending ? (
        <div className="space-y-2 px-4 py-4" aria-busy="true">
          <Skeleton className="h-5 w-1/2" />
        </div>
      ) : analytics.isError ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">Analytics are unavailable.</p>
      ) : (
        report && (
          <dl className="grid grid-cols-3 divide-x divide-border">
            <div className="px-4 py-3">
              <dt className="micro-label">Done</dt>
              <dd className="font-mono text-lg tabular-nums">{report.totals.completed}</dd>
              <dd className="font-mono text-[0.625rem] text-faint">
                {delta(report.totals.completed, report.previous.completed).text} vs last
              </dd>
            </div>
            <div className="px-4 py-3">
              <dt className="micro-label">Deadlines</dt>
              <dd className="font-mono text-lg tabular-nums">
                {report.totals.deadlines_met}/
                {report.totals.deadlines_met + report.totals.deadlines_missed}
              </dd>
              <dd className="font-mono text-[0.625rem] text-faint">met</dd>
            </div>
            <div className="px-4 py-3">
              <dt className="micro-label">Habits</dt>
              <dd className="font-mono text-lg tabular-nums">
                {percent(report.totals.habit_done, report.totals.habit_expected) ?? "—"}
                {report.totals.habit_expected ? "%" : ""}
              </dd>
              <dd className="font-mono text-[0.625rem] text-faint">adherence</dd>
            </div>
          </dl>
        )
      )}
    </motion.section>
  );
}
