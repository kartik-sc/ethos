import { useQuery } from "@/lib/query";
import { apiGet } from "@/lib/api";
import type { HealthReport } from "@/lib/types/health";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => apiGet<HealthReport>("/health", { signal, acceptStatuses: [503] }),
    refetchInterval: 30_000,
    retry: false,
  });
}
