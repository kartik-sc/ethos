import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiSend } from "@/lib/api";
import type { NextAction, Task, TaskCreate, TaskUpdate, TaskView } from "@/lib/types/tasks";

export const taskKeys = {
  all: ["tasks"] as const,
  view: (view: TaskView, projectId?: string) => ["tasks", view, projectId ?? "all"] as const,
  nextAction: ["tasks", "next-action"] as const,
};

export function useTasks(view: TaskView, projectId?: string) {
  const query = new URLSearchParams({ view });
  if (projectId) query.set("project_id", projectId);
  return useQuery({
    queryKey: taskKeys.view(view, projectId),
    queryFn: ({ signal }) => apiGet<Task[]>(`/tasks?${query}`, { signal }),
  });
}

export function useNextAction() {
  return useQuery({
    queryKey: taskKeys.nextAction,
    queryFn: ({ signal }) => apiGet<NextAction>("/tasks/next-action", { signal }),
  });
}

/**
 * Every task change can move tasks between views and change the Next Action,
 * so mutations optimistically drop the task from the view it left and then refetch all of them.
 */
function useTaskMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
  leavingTaskId?: (variables: TVariables) => string | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      const id = leavingTaskId?.(variables);
      if (!id) return undefined;
      await queryClient.cancelQueries({ queryKey: taskKeys.all });
      const snapshot = queryClient.getQueriesData<Task[]>({ queryKey: taskKeys.all });
      for (const [key, tasks] of snapshot) {
        if (Array.isArray(tasks)) {
          queryClient.setQueryData<Task[]>(
            key,
            tasks.filter((task) => task.id !== id),
          );
        }
      }
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      for (const [key, tasks] of context?.snapshot ?? []) queryClient.setQueryData(key, tasks);
    },
    // Project task counts change with every task change too.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: taskKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
      ]),
  });
}

export function useCreateTask() {
  return useTaskMutation((data: TaskCreate) => apiSend<Task>("POST", "/tasks", data));
}

interface UpdateVariables {
  id: string;
  changes: TaskUpdate;
}

export function useUpdateTask() {
  return useTaskMutation(
    ({ id, changes }: UpdateVariables) => apiSend<Task>("PATCH", `/tasks/${id}`, changes),
    ({ id, changes }) => (changes.status === undefined ? null : id),
  );
}

export function useTrashTask() {
  return useTaskMutation(
    (id: string) => apiSend("DELETE", `/tasks/${id}`),
    (id) => id,
  );
}

export function useRestoreTask() {
  return useTaskMutation(
    (id: string) => apiSend<Task>("POST", `/tasks/${id}/restore`),
    (id) => id,
  );
}

export function useOverrideNextAction() {
  return useTaskMutation((variables: { suggestedId: string | null; chosenId: string }) =>
    apiSend("POST", "/tasks/next-action/override", {
      suggested_task_id: variables.suggestedId,
      chosen_task_id: variables.chosenId,
    }),
  );
}
