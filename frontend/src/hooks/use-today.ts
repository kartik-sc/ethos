import { DEFAULT_TIMEZONE, isoDateIn } from "@/lib/time";

import { useNow } from "./use-now";

/** Today's date in the owner's timezone, or null before hydration. */
export function useToday(): string | null {
  const now = useNow();
  return now ? isoDateIn(now, DEFAULT_TIMEZONE) : null;
}
