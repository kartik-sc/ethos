import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useQuery } from "@/lib/query";
import { apiGet, apiSend } from "@/lib/api";
import type { ConvertRequest, InboxItem, InboxView } from "@/lib/types/inbox";

export const inboxKeys = {
  all: ["inbox"] as const,
  view: (view: InboxView) => ["inbox", view] as const,
};

export function useInbox(view: InboxView = "open") {
  return useQuery({
    queryKey: inboxKeys.view(view),
    queryFn: ({ signal }) => apiGet<InboxItem[]>(`/inbox?view=${view}`, { signal }),
  });
}

/** Converting creates a task, project or goal, so those caches refresh too. */
function useInboxMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<InboxItem>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () =>
      Promise.all(
        [inboxKeys.all, ["tasks"], ["projects"], ["goals"]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  });
}

export function useCapture() {
  return useInboxMutation((content: string) => apiSend<InboxItem>("POST", "/inbox", { content }));
}

export function useEditInboxItem() {
  return useInboxMutation(({ id, content }: { id: string; content: string }) =>
    apiSend<InboxItem>("PATCH", `/inbox/${id}`, { content }),
  );
}

export function useConvertInboxItem() {
  return useInboxMutation(({ id, request }: { id: string; request: ConvertRequest }) =>
    apiSend<InboxItem>("POST", `/inbox/${id}/convert`, request),
  );
}

export function useResolveInboxItem() {
  return useInboxMutation(({ id, outcome }: { id: string; outcome: "done" | "dismissed" }) =>
    apiSend<InboxItem>("POST", `/inbox/${id}/resolve`, { outcome }),
  );
}

export function useReopenInboxItem() {
  return useInboxMutation((id: string) => apiSend<InboxItem>("POST", `/inbox/${id}/reopen`));
}
