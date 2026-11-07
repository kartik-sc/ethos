import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useQuery } from "@/lib/query";
import { apiGet, apiSend } from "@/lib/api";
import type { Goal, GoalCreate, GoalUpdate, GoalView } from "@/lib/types/goals";

export const goalKeys = {
  all: ["goals"] as const,
  view: (view: GoalView) => ["goals", "list", view] as const,
  detail: (id: string) => ["goals", "detail", id] as const,
};

export function useGoals(view: GoalView = "active") {
  return useQuery({
    queryKey: goalKeys.view(view),
    queryFn: ({ signal }) => apiGet<Goal[]>(`/goals?view=${view}`, { signal }),
  });
}

export function useGoal(id: string) {
  return useQuery({
    queryKey: goalKeys.detail(id),
    queryFn: ({ signal }) => apiGet<Goal>(`/goals/${id}`, { signal }),
    retry: (count, error) => count < 2 && !("status" in error && error.status === 404),
  });
}

/** Goal changes alter how linked projects and tasks read, so those caches refresh too. */
function useGoalMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  options: { onSuccess?: (variables: TVariables) => void; keepDetail?: boolean } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (_result, variables) => options.onSuccess?.(variables),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: options.keepDetail === false ? ["goals", "list"] : goalKeys.all,
        }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      ]),
  });
}

export function useCreateGoal() {
  return useGoalMutation((data: GoalCreate) => apiSend<Goal>("POST", "/goals", data));
}

export function useUpdateGoal() {
  return useGoalMutation(({ id, changes }: { id: string; changes: GoalUpdate }) =>
    apiSend<Goal>("PATCH", `/goals/${id}`, changes),
  );
}

/** Like projects: navigate away before refreshing, and never refetch the trashed goal. */
export function useTrashGoal(onTrashed?: () => void) {
  const queryClient = useQueryClient();
  return useGoalMutation((id: string) => apiSend("DELETE", `/goals/${id}`), {
    keepDetail: false,
    onSuccess: (id) => {
      onTrashed?.();
      queryClient.removeQueries({ queryKey: goalKeys.detail(id), exact: true });
    },
  });
}

export function useRestoreGoal() {
  return useGoalMutation((id: string) => apiSend<Goal>("POST", `/goals/${id}/restore`));
}
