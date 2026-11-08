"use client";

import { Quote as QuoteIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard, useQuoteOfTheDay } from "@/hooks/use-dashboard";
import { cn } from "@/lib/utils";

const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
};

/** The task command centre: four numbers, no chart. */
export function TaskStrip() {
  const dashboard = useDashboard();
  const counts = dashboard.data?.tasks;
  const cells = [
    { label: "Open", value: counts?.open, href: "/tasks" },
    { label: "Overdue", value: counts?.overdue, href: "/tasks", alert: (counts?.overdue ?? 0) > 0 },
    { label: "Done today", value: counts?.done_today, href: "/tasks" },
    { label: "Done this week", value: counts?.done_this_week, href: "/tasks" },
  ];

  return (
    <motion.dl
      {...fadeIn}
      aria-label="Tasks"
      className="grid grid-cols-2 divide-border overflow-hidden rounded-xl border border-border bg-card/80 sm:grid-cols-4 sm:divide-x [&>div:nth-child(-n+2)]:border-b [&>div:nth-child(-n+2)]:border-border sm:[&>div:nth-child(-n+2)]:border-b-0"
    >
      {cells.map((cell) => (
        <div key={cell.label} className="flex flex-col gap-1 px-4 py-3">
          <dt className="micro-label">{cell.label}</dt>
          <dd>
            {dashboard.isPending ? (
              <Skeleton className="h-6 w-10" />
            ) : dashboard.isError ? (
              <span className="font-mono text-sm text-faint">—</span>
            ) : (
              <Link
                href={cell.href}
                className={cn(
                  "font-mono text-xl tabular-nums outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring",
                  cell.alert ? "text-destructive" : "text-foreground",
                )}
              >
                {cell.value}
              </Link>
            )}
          </dd>
        </div>
      ))}
    </motion.dl>
  );
}

export function QuoteCard() {
  const quote = useQuoteOfTheDay();

  return (
    <motion.figure
      {...fadeIn}
      transition={{ ...fadeIn.transition, delay: 0.12 }}
      className="relative overflow-hidden rounded-xl border border-border bg-card/80 px-5 py-5"
    >
      <QuoteIcon aria-hidden="true" className="absolute top-4 right-4 size-8 text-primary/10" />
      {quote.isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : quote.isError ? (
        <p className="text-sm text-muted-foreground">The quote couldn&apos;t load.</p>
      ) : quote.data === null ? (
        <p className="text-sm text-muted-foreground">
          No quotes yet.{" "}
          <Link href="/settings#quotes" className="text-primary hover:underline">
            Add your own
          </Link>{" "}
          and one shows here each day.
        </p>
      ) : (
        <>
          <blockquote className="pr-8 text-[0.9375rem] leading-relaxed text-pretty">
            {quote.data.text}
          </blockquote>
          {quote.data.author && (
            <figcaption className="mt-3 font-mono text-[0.6875rem] text-faint">
              — {quote.data.author}
            </figcaption>
          )}
        </>
      )}
    </motion.figure>
  );
}
