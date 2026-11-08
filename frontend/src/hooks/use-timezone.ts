import { DEFAULT_TIMEZONE } from "@/lib/time";

import { useAppPreferences } from "./use-app-preferences";

/** The owner's configured timezone, or null until preferences load (the default if they fail). */
export function useTimezone(): string | null {
  const preferences = useAppPreferences();
  if (preferences.data) return preferences.data.timezone;
  return preferences.isError ? DEFAULT_TIMEZONE : null;
}
