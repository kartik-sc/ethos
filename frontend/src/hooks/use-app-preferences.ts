import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useQuery } from "@/lib/query";
import { apiGet, apiSend } from "@/lib/api";

/** Server-side preferences (mirrors backend/app/preferences). Theme lives in the browser. */
export interface AppPreferences {
  archive_after_days: number;
  timezone: string;
  default_task_minutes: number;
  /** Local "HH:MM:SS". */
  day_starts_at: string;
  day_ends_at: string;
}

const key = ["preferences"] as const;

export function useAppPreferences() {
  return useQuery({
    queryKey: key,
    queryFn: ({ signal }) => apiGet<AppPreferences>("/preferences", { signal }),
  });
}

export function useUpdateAppPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: Partial<AppPreferences>) =>
      apiSend<AppPreferences>("PATCH", "/preferences", changes),
    onSuccess: (preferences) => queryClient.setQueryData(key, preferences),
    // The archive period decides which tasks read as Done or Archived, and the timezone
    // decides what "today" means everywhere, so every view refreshes.
    onSettled: () =>
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== "preferences" }),
  });
}
