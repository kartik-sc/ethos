import { keepPreviousData } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import { useQuery } from "@/lib/query";
import { searchParams } from "@/lib/search";
import type { SearchFilters, SearchResults } from "@/lib/types/search";

export function useSearch(query: string, filters: SearchFilters) {
  const params = searchParams(query, filters);
  return useQuery({
    queryKey: ["search", params.toString()],
    queryFn: ({ signal }) => apiGet<SearchResults>(`/search?${params}`, { signal }),
    enabled: query.trim().length > 0,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}
