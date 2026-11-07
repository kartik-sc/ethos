import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiSend } from "@/lib/api";
import type { Project, ProjectCreate, ProjectUpdate, ProjectView } from "@/lib/types/projects";

export const projectKeys = {
  all: ["projects"] as const,
  view: (view: ProjectView) => ["projects", "list", view] as const,
  detail: (id: string) => ["projects", "detail", id] as const,
};

export function useProjects(view: ProjectView = "active") {
  return useQuery({
    queryKey: projectKeys.view(view),
    queryFn: ({ signal }) => apiGet<Project[]>(`/projects?view=${view}`, { signal }),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: ({ signal }) => apiGet<Project>(`/projects/${id}`, { signal }),
    retry: (count, error) => count < 2 && !("status" in error && error.status === 404),
  });
}

/** Project changes move tasks in and out of Trash, so both caches refresh. */
function useProjectMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: projectKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      ]),
  });
}

export function useCreateProject() {
  return useProjectMutation((data: ProjectCreate) => apiSend<Project>("POST", "/projects", data));
}

export function useUpdateProject() {
  return useProjectMutation(({ id, changes }: { id: string; changes: ProjectUpdate }) =>
    apiSend<Project>("PATCH", `/projects/${id}`, changes),
  );
}

/**
 * `onTrashed` runs before caches refresh: refetching the open project would 404 and unmount the
 * caller before a per-call callback could fire. Its detail query is dropped, not refetched.
 */
export function useTrashProject(onTrashed?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiSend<{ tasks_moved: number }>("DELETE", `/projects/${id}`),
    onSuccess: (_result, id) => {
      onTrashed?.();
      queryClient.removeQueries({ queryKey: projectKeys.detail(id), exact: true });
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects", "list"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      ]),
  });
}

export function useRestoreProject() {
  return useProjectMutation((id: string) => apiSend<Project>("POST", `/projects/${id}/restore`));
}
