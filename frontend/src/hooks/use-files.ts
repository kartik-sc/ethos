import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiSend, apiUpload } from "@/lib/api";
import { useQuery } from "@/lib/query";
import type { FileAsset, FileView } from "@/lib/types/files";

export const fileKeys = {
  all: ["files"] as const,
  project: (projectId: string, view: FileView) => ["files", projectId, view] as const,
};

export function useProjectFiles(projectId: string, view: FileView = "active") {
  return useQuery({
    queryKey: fileKeys.project(projectId, view),
    queryFn: ({ signal }) =>
      apiGet<FileAsset[]>(`/projects/${projectId}/files?view=${view}`, { signal }),
  });
}

function useFileMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: fileKeys.all }),
  });
}

export interface UploadVariables {
  projectId: string;
  file: File;
  replace?: boolean;
}

export function useUploadFile() {
  return useFileMutation(({ projectId, file, replace = false }: UploadVariables) =>
    apiUpload<FileAsset>(
      `/projects/${projectId}/files`,
      file,
      new URLSearchParams({ filename: file.name, replace: String(replace) }),
    ),
  );
}

export function useRenameFile() {
  return useFileMutation(({ id, filename }: { id: string; filename: string }) =>
    apiSend<FileAsset>("PATCH", `/files/${id}`, { filename }),
  );
}

export function useTrashFile() {
  return useFileMutation((id: string) => apiSend("DELETE", `/files/${id}`));
}

export function useRestoreFile() {
  return useFileMutation((id: string) => apiSend<FileAsset>("POST", `/files/${id}/restore`));
}
