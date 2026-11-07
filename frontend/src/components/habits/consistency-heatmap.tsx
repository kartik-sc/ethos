import { formatShortDate } from "@/lib/time";
import type { DayRead } from "@/lib/types/habits";
import { cn } from "@/lib/utils";

import { dayFill, dayLabel } from "./day-states";

const CELL = 11;
const GAP = 3;
const LABEL_WIDTH = 14;
const ROW_LABELS = ["M", "", "W", "", "F", "", "S"];

interface ConsistencyHeatmapProps {
  /** Whole weeks, Monday first, oldest first. */
  days: DayRead[];
  unit?: string | null;
}

export function ConsistencyHeatmap({ days, unit }: ConsistencyHeatmapProps) {
  const weeks = Math.ceil(days.length / 7);
  const width = LABEL_WIDTH + weeks * (CELL + GAP) - GAP;
  const height = 7 * (CELL + GAP) - GAP;
  const counted = days.filter((day) => day.state === "met" || day.state === "missed");
  const met = counted.filter((day) => day.state === "met").length;

  return (
    <figure className="flex flex-col gap-2">
      <div className="overflow-x-auto pb-1">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${weeks} weeks: ${met} days done out of ${counted.length} expected`}
        >
          {ROW_LABELS.map((label, row) =>
            label ? (
              <text
                key={row}
                x={0}
                y={row * (CELL + GAP) + CELL - 2}
                className="fill-faint font-mono text-[8px]"
              >
                {label}
              </text>
            ) : null,
          )}
          {days.map((day, index) => {
            const column = Math.floor(index / 7);
            const row = index % 7;
            const amount = day.amount ? ` · ${Number(day.amount)} ${unit ?? ""}` : "";
            return (
              <rect
                key={day.date}
                x={LABEL_WIDTH + column * (CELL + GAP)}
                y={row * (CELL + GAP)}
                width={CELL}
                height={CELL}
                rx={2.5}
                strokeWidth={1}
                className={cn(dayFill[day.state])}
              >
                <title>{`${formatShortDate(day.date)}: ${dayLabel[day.state]}${amount}`}</title>
              </rect>
            );
          })}
        </svg>
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.625rem] text-faint">
        {(["met", "partial", "missed", "rest"] as const).map((state) => (
          <span key={state} className="inline-flex items-center gap-1.5">
            <svg width={8} height={8} aria-hidden="true">
              <rect width={8} height={8} rx={2} className={dayFill[state]} />
            </svg>
            {dayLabel[state]}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
