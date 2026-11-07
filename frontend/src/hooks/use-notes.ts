import { keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiSend } from "@/lib/api";
import { useQuery } from "@/lib/query";
import type {
  Folder,
  LinkTarget,
  Note,
  NoteSummary,
  NoteTree,
  Version,
  VersionSummary,
} from "@/lib/types/notes";

export const noteKeys = {
  all: ["notes"] as const,
  tree: ["notes", "tree"] as const,
  trash: ["notes", "trash"] as const,
  note: (id: string) => ["notes", "note", id] as const,
  versions: (id: string) => ["notes", "versions", id] as const,
};

export function useNoteTree() {
  return useQuery({
    queryKey: noteKeys.tree,
    queryFn: ({ signal }) => apiGet<NoteTree>("/notes/tree", { signal }),
  });
}

export function useTrashedNotes() {
  return useQuery({
    queryKey: noteKeys.trash,
    queryFn: ({ signal }) => apiGet<NoteSummary[]>("/notes/trash", { signal }),
  });
}

export function useNote(id: string) {
  return useQuery({
    queryKey: noteKeys.note(id),
    queryFn: ({ signal }) => apiGet<Note>(`/notes/${id}`, { signal }),
    retry: (count, error) => count < 2 && !("status" in error && error.status === 404),
    // The editor owns the text while open; background refetches must not replace a draft.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
}

export function useNoteVersions(id: string, enabled: boolean) {
  return useQuery({
    queryKey: noteKeys.versions(id),
    queryFn: ({ signal }) => apiGet<VersionSummary[]>(`/notes/${id}/versions`, { signal }),
    enabled,
  });
}

export function fetchVersion(noteId: string, versionId: string) {
  return apiGet<Version>(`/notes/${noteId}/versions/${versionId}`);
}

export function useLinkTargets(query: string | null) {
  return useQuery({
    queryKey: ["notes", "link-targets", query],
    queryFn: ({ signal }) =>
      apiGet<LinkTarget[]>(`/notes/link-targets?q=${encodeURIComponent(query ?? "")}`, { signal }),
    enabled: query !== null,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

function useNotesMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: noteKeys.tree }),
        queryClient.invalidateQueries({ queryKey: noteKeys.trash }),
      ]),
  });
}

export function useCreateNote() {
  return useNotesMutation(
    (data: { title: string; folder_id?: string | null; content?: string; tags?: string[] }) =>
      apiSend<Note>("POST", "/notes", data),
  );
}

export function useTrashNote() {
  return useNotesMutation((id: string) => apiSend("DELETE", `/notes/${id}`));
}

export function useRestoreNote() {
  return useNotesMutation((id: string) => apiSend<Note>("POST", `/notes/${id}/restore`));
}

export function useCreateFolder() {
  return useNotesMutation((data: { name: string; parent_id: string | null }) =>
    apiSend<Folder>("POST", "/note-folders", data),
  );
}

export function useUpdateFolder() {
  return useNotesMutation(
    ({ id, ...changes }: { id: string; name?: string; parent_id?: string | null }) =>
      apiSend<Folder>("PATCH", `/note-folders/${id}`, changes),
  );
}

export function useDeleteFolder() {
  return useNotesMutation((id: string) => apiSend("DELETE", `/note-folders/${id}`));
}

export interface ImportResult {
  created: { id: string; title: string }[];
  renamed: { path: string; title: string }[];
  skipped: { path: string; reason: string }[];
  folders_created: number;
}

export function useImportNotes() {
  return useNotesMutation(
    (data: { folder_id: string | null; files: { path: string; content: string }[] }) =>
      apiSend<ImportResult>("POST", "/notes/import", data),
  );
}

export function fetchFolderExport(folderId: string) {
  return apiGet<{ path: string; content: string }[]>(`/note-folders/${folderId}/export`);
}
