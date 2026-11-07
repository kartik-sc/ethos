import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useQuery } from "@/lib/query";
import { apiGet, apiSend } from "@/lib/api";

/** Server-side preferences (mirrors backend/app/preferences). Theme lives in the browser. */
export interface AppPreferences {
  archive_after_days: number;
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
    // The archive period decides which tasks read as Done or Archived.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}
