"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { ViewTabs } from "@/components/view-tabs";
import { useDashboard } from "@/hooks/use-dashboard";
import {
  deadlineHref,
  describeDays,
  inWindow,
  type Placed,
  placeDeadlines,
  RADAR_WINDOWS,
  type RadarWindow,
} from "@/lib/radar";
import type { Deadline } from "@/lib/types/dashboard";
import { cn } from "@/lib/utils";

const WIDTH = 600;
const HEIGHT = 64;
const OVERDUE_BAND = 52;
const TRACK_START = OVERDUE_BAND + 14;
const TRACK_END = WIDTH - 10;
const BASELINE = 40;
const LIST_LIMIT = 8;

const windows = RADAR_WINDOWS.map((days) => ({ value: String(days), label: `${days}d` }));

function tone(deadline: Deadline): string {
  if (deadline.days < 0) return "fill-destructive stroke-destructive";
  if (deadline.days <= 2) return "fill-primary stroke-primary";
  return "fill-muted-foreground stroke-muted-foreground";
}

function Marker({ placed }: { placed: Placed }) {
  const { deadline, x, lane } = placed;
  const cx =
    x < 0 ? OVERDUE_BAND / 2 + (lane % 3) * 9 - 9 : TRACK_START + x * (TRACK_END - TRACK_START);
  const cy = BASELINE - 10 - (x < 0 ? Math.floor(lane / 3) : lane) * 11;
  const label = `${deadline.title}: ${describeDays(deadline.days)}`;

  return (
    <g className={tone(deadline)}>
      <title>{label}</title>
      {deadline.kind === "task" && <circle cx={cx} cy={cy} r={4} />}
      {deadline.kind === "project" && <rect x={cx - 4} y={cy - 4} width={8} height={8} rx={1.5} />}
      {deadline.kind === "goal" && (
        <rect x={cx - 3.5} y={cy - 3.5} width={7} height={7} transform={`rotate(45 ${cx} ${cy})`} />
      )}
    </g>
  );
}

function Timeline({ deadlines, window }: { deadlines: Deadline[]; window: RadarWindow }) {
  const placed = placeDeadlines(deadlines, window);
  const ticks = [0, Math.round(window / 2), window];
  const overdue = placed.filter((item) => item.x < 0).length;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-auto w-full"
      role="img"
      aria-label={`${placed.length} deadlines in the next ${window} days, ${overdue} overdue`}
    >
      <rect
        x={0}
        y={4}
        width={OVERDUE_BAND}
        height={BASELINE + 2}
        rx={6}
        className="fill-destructive/8"
      />
      <text
        x={OVERDUE_BAND / 2}
        y={HEIGHT - 4}
        textAnchor="middle"
        className="fill-destructive/80 font-mono text-[9px]"
      >
        overdue
      </text>
      <line
        x1={TRACK_START}
        x2={TRACK_END}
        y1={BASELINE}
        y2={BASELINE}
        className="stroke-border-strong"
        strokeWidth={1}
      />
      {ticks.map((day) => {
        const x = TRACK_START + (day / window) * (TRACK_END - TRACK_START);
        return (
          <g key={day}>
            <line
              x1={x}
              x2={x}
              y1={BASELINE - 3}
              y2={BASELINE + 3}
              className="stroke-border-strong"
            />
            <text
              x={x}
              y={HEIGHT - 4}
              textAnchor={day === 0 ? "start" : day === window ? "end" : "middle"}
              className="fill-faint font-mono text-[9px]"
            >
              {day === 0 ? "today" : `+${day}d`}
            </text>
          </g>
        );
      })}
      {placed.map((item) => (
        <Marker key={`${item.deadline.kind}-${item.deadline.id}`} placed={item} />
      ))}
    </svg>
  );
}

const kindGlyph: Record<Deadline["kind"], string> = { task: "●", project: "■", goal: "◆" };

export function DeadlineRadar() {
  const dashboard = useDashboard();
  const [window, setWindow] = useState<RadarWindow>(14);
  const visible = dashboard.data ? inWindow(dashboard.data.deadlines, window) : [];

  return (
    <motion.section
      aria-labelledby="radar-heading"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border border-border bg-card/80 backdrop-blur-[2px]"
    >
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-1.5">
        <h2 id="radar-heading" className="micro-label">
          Deadline radar
        </h2>
        <ViewTabs
          label="Radar window"
          views={windows}
          value={String(window)}
          onChange={(value) => setWindow(Number(value) as RadarWindow)}
        />
      </div>

      {dashboard.isPending ? (
        <div className="space-y-3 px-4 py-4" aria-busy="true">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : dashboard.isError ? (
        <div className="flex items-center justify-between gap-3 px-4 py-4 text-sm text-muted-foreground">
          <span>Deadlines are unavailable: {dashboard.error.message}.</span>
          <button
            type="button"
            onClick={() => void dashboard.refetch()}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
          <Timeline deadlines={dashboard.data.deadlines} window={window} />
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing due in the next {window} days, and nothing overdue.
            </p>
          ) : (
            <ul className="flex flex-col">
              {visible.slice(0, LIST_LIMIT).map((deadline) => (
                <li key={`${deadline.kind}-${deadline.id}`}>
                  <Link
                    href={deadlineHref(deadline)}
                    className="flex items-baseline gap-3 rounded-md px-1 py-1 text-sm outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      aria-label={deadline.kind}
                      className={cn(
                        "w-3 shrink-0 text-center text-[0.625rem]",
                        deadline.days < 0
                          ? "text-destructive"
                          : deadline.days <= 2
                            ? "text-primary"
                            : "text-faint",
                      )}
                    >
                      {kindGlyph[deadline.kind]}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {deadline.title}
                      {deadline.context && (
                        <span className="ml-2 font-mono text-[0.6875rem] text-faint">
                          {deadline.context}
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-mono text-[0.6875rem]",
                        deadline.days < 0 ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {describeDays(deadline.days)}
                    </span>
                  </Link>
                </li>
              ))}
              {visible.length > LIST_LIMIT && (
                <li className="px-1 pt-1 font-mono text-[0.6875rem] text-faint">
                  +{visible.length - LIST_LIMIT} more
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </motion.section>
  );
}
