import { isoDateIn } from "@/lib/time";

import { useNow } from "./use-now";
import { useTimezone } from "./use-timezone";

/** Today's date in the owner's timezone, or null before hydration and preferences. */
export function useToday(): string | null {
  const now = useNow();
  const timeZone = useTimezone();
  return now && timeZone ? isoDateIn(now, timeZone) : null;
}
