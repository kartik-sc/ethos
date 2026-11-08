import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiSend } from "@/lib/api";
import { useQuery } from "@/lib/query";
import type { CalendarBlock, CalendarStatus, PlanResult } from "@/lib/types/calendar";

export const calendarKeys = {
  all: ["calendar"] as const,
  blocks: (start: string, end: string) => ["calendar", "blocks", start, end] as const,
  status: ["calendar", "status"] as const,
};

/** Blocks overlapping the local dates `start`…`end`; the server's today when omitted. */
export function useCalendarBlocks(start?: string, end?: string) {
  const query = new URLSearchParams();
  if (start) query.set("start", start);
  if (end) query.set("end", end);
  return useQuery({
    queryKey: calendarKeys.blocks(start ?? "today", end ?? start ?? "today"),
    queryFn: ({ signal }) => apiGet<CalendarBlock[]>(`/calendar/blocks?${query}`, { signal }),
    refetchInterval: 5 * 60_000,
  });
}

export function useCalendarStatus() {
  return useQuery({
    queryKey: calendarKeys.status,
    queryFn: ({ signal }) => apiGet<CalendarStatus>("/calendar/status", { signal }),
  });
}

function useCalendarMutation<TVariables, TResult>(fn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: calendarKeys.all }),
  });
}

export function useScheduleTask() {
  return useCalendarMutation((taskId: string) =>
    apiSend<CalendarBlock>("POST", `/calendar/tasks/${taskId}/schedule`),
  );
}

export function usePlanTasks() {
  return useCalendarMutation((request: { horizon_days: number; apply: boolean }) =>
    apiSend<PlanResult>("POST", "/calendar/plan", request),
  );
}

export function useRemoveBlock() {
  return useCalendarMutation((id: string) => apiSend("DELETE", `/calendar/blocks/${id}`));
}
