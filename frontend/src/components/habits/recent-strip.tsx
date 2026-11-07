import { WEEKDAY_LETTERS } from "@/lib/habits";
import { formatShortDate } from "@/lib/time";
import type { DayRead } from "@/lib/types/habits";
import { cn } from "@/lib/utils";

import { dayBackground, dayLabel } from "./day-states";

/** The last seven days as small labelled cells, today last. */
export function RecentStrip({ days }: { days: DayRead[] }) {
  return (
    <ol aria-label="Last seven days" className="flex items-end gap-1">
      {days.map((day) => {
        const weekday = (new Date(`${day.date}T00:00:00Z`).getUTCDay() + 6) % 7;
        return (
          <li key={day.date} className="flex flex-col items-center gap-1">
            <span
              title={`${formatShortDate(day.date)}: ${dayLabel[day.state]}`}
              className={cn("block size-3 rounded-[3px]", dayBackground[day.state])}
            >
              <span className="sr-only">{`${formatShortDate(day.date)}: ${dayLabel[day.state]}`}</span>
            </span>
            <span aria-hidden="true" className="font-mono text-[0.5625rem] leading-none text-faint">
              {WEEKDAY_LETTERS[weekday]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
