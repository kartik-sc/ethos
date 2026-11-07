import { keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";

import { apiSend } from "@/lib/api";
import { useQuery } from "@/lib/query";
import type { CommandPreview, CommandResult } from "@/lib/types/commands";

export function useCommandPreview(text: string | null) {
  return useQuery({
    queryKey: ["commands", "preview", text],
    queryFn: () => apiSend<CommandPreview>("POST", "/commands/preview", { text }),
    enabled: text !== null,
    placeholderData: keepPreviousData,
    staleTime: 5_000,
  });
}

/** A command can create almost anything, so every list refreshes afterwards. */
export function useRunCommand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { text: string; confirm_duplicate?: boolean }) =>
      apiSend<CommandResult>("POST", "/commands/run", variables),
    onSuccess: () =>
      Promise.all(
        ["tasks", "projects", "goals", "habits", "inbox", "notes", "commands", "analytics"].map(
          (key) => queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      ),
  });
}
