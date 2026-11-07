"use client";

import { useState } from "react";

import { niceMax } from "@/lib/analytics";
import { formatShortDate } from "@/lib/time";
import type { Period } from "@/lib/types/analytics";
import { cn } from "@/lib/utils";

const WIDTH = 640;
const HEIGHT = 168;
const LEFT = 26;
const RIGHT = 4;
const TOP = 10;
const BOTTOM = 22;
const GAP = 2;
const RADIUS = 4;

interface DailyBarsProps {
  days: { date: string; count: number }[];
  period: Period;
  /** Days after this are drawn as not-yet-happened. */
  today: string | null;
}

/** A column whose top corners are rounded and whose base sits flat on the axis. */
function columnPath(x: number, y: number, width: number, base: number): string {
  const r = Math.min(RADIUS, width / 2, base - y);
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${base}Z`;
}

function tickLabel(date: string, index: number, total: number, period: Period): string | null {
  const day = Number(date.slice(8, 10));
  if (period === "week") return formatShortDate(date).split(" ")[0];
  return index === 0 || index === total - 1 || day % 5 === 0 ? String(day) : null;
}

export function DailyBars({ days, period, today }: DailyBarsProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = niceMax(days.map((day) => day.count));
  const base = HEIGHT - BOTTOM;
  const plotHeight = base - TOP;
  const slot = (WIDTH - LEFT - RIGHT) / days.length;
  const barWidth = Math.max(2, slot - GAP);
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const active = hovered === null ? null : days[hovered];

  return (
    <figure className="flex flex-col gap-2">
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full"
          role="group"
          aria-label={`Tasks completed per day: ${total} in total`}
          onMouseLeave={() => setHovered(null)}
        >
          <line
            x1={LEFT}
            x2={WIDTH - RIGHT}
            y1={TOP}
            y2={TOP}
            className="stroke-border"
            strokeDasharray="2 4"
          />
          <line x1={LEFT} x2={WIDTH - RIGHT} y1={base} y2={base} className="stroke-border-strong" />
          <text
            x={LEFT - 6}
            y={TOP + 3}
            textAnchor="end"
            className="fill-faint font-mono text-[9px]"
          >
            {max}
          </text>
          <text
            x={LEFT - 6}
            y={base + 3}
            textAnchor="end"
            className="fill-faint font-mono text-[9px]"
          >
            0
          </text>

          {days.map((day, index) => {
            const x = LEFT + index * slot + GAP / 2;
            const height = (day.count / max) * plotHeight;
            const future = today !== null && day.date > today;
            const label = tickLabel(day.date, index, days.length, period);
            return (
              <g key={day.date}>
                {day.count > 0 ? (
                  <path
                    d={columnPath(x, base - height, barWidth, base)}
                    className={cn(
                      "fill-primary transition-opacity",
                      hovered !== null && hovered !== index && "opacity-50",
                    )}
                  />
                ) : (
                  <rect
                    x={x}
                    y={base - 1.5}
                    width={barWidth}
                    height={1.5}
                    rx={0.75}
                    className={future ? "fill-transparent" : "fill-border-strong"}
                  />
                )}
                {label && (
                  <text
                    x={x + barWidth / 2}
                    y={HEIGHT - 6}
                    textAnchor="middle"
                    className={cn("font-mono text-[9px]", future ? "fill-faint/60" : "fill-faint")}
                  >
                    {label}
                  </text>
                )}
                {/* The hit target spans the whole column, much larger than the bar. */}
                <rect
                  x={LEFT + index * slot}
                  y={TOP}
                  width={slot}
                  height={plotHeight}
                  className="fill-transparent outline-none focus-visible:stroke-ring"
                  tabIndex={0}
                  aria-label={`${formatShortDate(day.date)}: ${day.count} completed`}
                  onMouseEnter={() => setHovered(index)}
                  onFocus={() => setHovered(index)}
                  onBlur={() => setHovered(null)}
                />
              </g>
            );
          })}
        </svg>

        {active && hovered !== null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border border-border-strong bg-popover px-2 py-1 text-xs whitespace-nowrap shadow-lg"
            style={{ left: `${((LEFT + (hovered + 0.5) * slot) / WIDTH) * 100}%` }}
          >
            <span className="text-muted-foreground">{formatShortDate(active.date)}</span>{" "}
            <span className="font-mono">{active.count}</span>{" "}
            <span className="text-muted-foreground">completed</span>
          </div>
        )}
      </div>

      <details className="text-xs text-muted-foreground">
        <summary className="w-fit cursor-pointer font-mono text-[0.6875rem] text-faint">
          Show as table
        </summary>
        <table className="mt-2 w-full max-w-xs">
          <thead>
            <tr className="text-left text-faint">
              <th className="font-normal">Day</th>
              <th className="text-right font-normal">Completed</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.date}>
                <td>{formatShortDate(day.date)}</td>
                <td className="text-right font-mono">{day.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
