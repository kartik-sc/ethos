import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useQuery } from "@/lib/query";
import { apiGet, apiSend } from "@/lib/api";
import type { Dashboard, Quote } from "@/lib/types/dashboard";

export function useDashboard() {
  return useQuery({
    // Under "tasks" so every task, project and goal change refreshes the radar and counts.
    queryKey: ["tasks", "dashboard"],
    queryFn: ({ signal }) => apiGet<Dashboard>("/dashboard", { signal }),
  });
}

export function useQuoteOfTheDay() {
  return useQuery({
    queryKey: ["quotes", "today"],
    queryFn: ({ signal }) => apiGet<Quote | null>("/quotes/today", { signal }),
    staleTime: 60 * 60_000,
  });
}

export function useQuotes() {
  return useQuery({
    queryKey: ["quotes", "list"],
    queryFn: ({ signal }) => apiGet<Quote[]>("/quotes", { signal }),
  });
}

function useQuoteMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["quotes"] }),
  });
}

export function useSaveQuote() {
  return useQuoteMutation(
    ({ id, text, author }: { id?: string; text: string; author: string | null }) =>
      id
        ? apiSend<Quote>("PUT", `/quotes/${id}`, { text, author })
        : apiSend<Quote>("POST", "/quotes", { text, author }),
  );
}

export function useDeleteQuote() {
  return useQuoteMutation((id: string) => apiSend("DELETE", `/quotes/${id}`));
}
