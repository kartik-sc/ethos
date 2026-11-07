"use client";

import { motion } from "motion/react";

import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/use-now";
import { DEFAULT_TIMEZONE, formatClock, formatLongDate, getDayPart, hourIn } from "@/lib/time";

export function Greeting() {
  const now = useNow();
  const timeZone = DEFAULT_TIMEZONE;

  if (!now) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
    );
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <h1 className="text-[2rem] leading-tight font-medium tracking-[-0.02em] md:text-[2.5rem]">
        Good {getDayPart(hourIn(now, timeZone))}.
      </h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 font-mono text-[0.8125rem] text-muted-foreground">
        <span className="text-primary" aria-hidden="true">
          ›
        </span>
        <span>{formatLongDate(now, timeZone)}</span>
        <span className="text-faint" aria-hidden="true">
          ·
        </span>
        <time dateTime={now.toISOString()}>{formatClock(now, timeZone)}</time>
        <span className="text-faint">{timeZone.toLowerCase()}</span>
      </p>
    </motion.header>
  );
}
