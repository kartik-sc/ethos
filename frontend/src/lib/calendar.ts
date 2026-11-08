import { isoDateIn } from "./time";

export type BlockPhase = "past" | "now" | "upcoming";

export function blockPhase(block: { starts_at: string; ends_at: string }, now: Date): BlockPhase {
  const time = now.getTime();
  if (Date.parse(block.ends_at) <= time) return "past";
  return Date.parse(block.starts_at) <= time ? "now" : "upcoming";
}

function clock(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(new Date(iso));
}

/** "09:00–10:30" in the owner's timezone. */
export function formatTimeRange(startsAt: string, endsAt: string, timeZone: string): string {
  return `${clock(startsAt, timeZone)}–${clock(endsAt, timeZone)}`;
}

/** "today 09:00–10:30", "tomorrow …" or "Wed 12 Nov …", relative to `today`. */
export function formatSlot(
  startsAt: string,
  endsAt: string,
  timeZone: string,
  today: string,
): string {
  const day = isoDateIn(new Date(startsAt), timeZone);
  const offset = Math.round((Date.parse(day) - Date.parse(today)) / 86_400_000);
  const label =
    offset === 0
      ? "today"
      : offset === 1
        ? "tomorrow"
        : new Intl.DateTimeFormat("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            timeZone,
          }).format(new Date(startsAt));
  return `${label} ${formatTimeRange(startsAt, endsAt, timeZone)}`;
}

export function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

const reasons: Record<string, string> = {
  "deadline has passed": "Deadline has passed. Schedule it yourself if it still matters.",
  "no free slot before the deadline": "No free slot before its deadline.",
  "no free slot": "No free slot in this period.",
  "longer than the working day": "Longer than the working day in Settings.",
};

export function unplacedReason(reason: string): string {
  return reasons[reason] ?? reason;
}
