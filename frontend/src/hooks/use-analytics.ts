import { keepPreviousData } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import { useQuery } from "@/lib/query";
import type { AnalyticsReport, Period } from "@/lib/types/analytics";

export function useAnalytics(period: Period, offset: number) {
  return useQuery({
    queryKey: ["analytics", period, offset],
    queryFn: ({ signal }) =>
      apiGet<AnalyticsReport>(`/analytics?period=${period}&offset=${offset}`, { signal }),
    placeholderData: keepPreviousData,
  });
}
