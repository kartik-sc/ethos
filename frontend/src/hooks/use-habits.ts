import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useQuery } from "@/lib/query";
import { apiGet, apiSend } from "@/lib/api";
import type { DayRead, Habit, HabitInput, HabitView, LogInput } from "@/lib/types/habits";

export const habitKeys = {
  all: ["habits"] as const,
  list: (view: HabitView, goalId?: string) => ["habits", "list", view, goalId ?? "-"] as const,
  history: (id: string, weeks: number) => ["habits", "history", id, weeks] as const,
};

export function useHabits(view: HabitView = "active", goalId?: string) {
  const query = new URLSearchParams({ view });
  if (goalId) query.set("goal_id", goalId);
  return useQuery({
    queryKey: habitKeys.list(view, goalId),
    queryFn: ({ signal }) => apiGet<Habit[]>(`/habits?${query}`, { signal }),
  });
}

export function useHabitHistory(id: string, weeks: number) {
  return useQuery({
    queryKey: habitKeys.history(id, weeks),
    queryFn: ({ signal }) => apiGet<DayRead[]>(`/habits/${id}/history?weeks=${weeks}`, { signal }),
  });
}

function useHabitMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  onSuccess?: (variables: TVariables) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (_result, variables) => onSuccess?.(variables),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: habitKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["goals"] }),
      ]),
  });
}

export function useCreateHabit() {
  return useHabitMutation((data: HabitInput) => apiSend<Habit>("POST", "/habits", data));
}

export function useUpdateHabit() {
  return useHabitMutation(({ id, changes }: { id: string; changes: Partial<HabitInput> }) =>
    apiSend<Habit>("PATCH", `/habits/${id}`, changes),
  );
}

export function useTrashHabit(onTrashed?: () => void) {
  return useHabitMutation((id: string) => apiSend("DELETE", `/habits/${id}`), onTrashed);
}

export function useRestoreHabit() {
  return useHabitMutation((id: string) => apiSend<Habit>("POST", `/habits/${id}/restore`));
}

interface LogVariables {
  habitId: string;
  date: string;
  /** null clears the day's entry. */
  entry: LogInput | null;
}

/** Writes or clears one day. The response is the habit's fresh summary, applied straight away. */
export function useLogHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ habitId, date, entry }: LogVariables) =>
      entry === null
        ? apiSend<Habit>("DELETE", `/habits/${habitId}/logs/${date}`)
        : apiSend<Habit>("PUT", `/habits/${habitId}/logs/${date}`, entry),
    onSuccess: (habit) => {
      queryClient.setQueriesData<Habit[]>({ queryKey: ["habits", "list"] }, (habits) =>
        habits?.map((existing) => (existing.id === habit.id ? habit : existing)),
      );
    },
    onSettled: (_habit, _error, { habitId }) =>
      queryClient.invalidateQueries({ queryKey: ["habits", "history", habitId] }),
  });
}
