import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiSend } from "@/lib/api";
import { useQuery } from "@/lib/query";
import type { IntegrationToken, IntegrationTokenCreated } from "@/lib/types/integrations";

const tokenKeys = { all: ["integration-tokens"] as const };

export function useIntegrationTokens() {
  return useQuery({
    queryKey: tokenKeys.all,
    queryFn: ({ signal }) => apiGet<IntegrationToken[]>("/integration-tokens", { signal }),
  });
}

function useTokenMutation<TVariables, TResult>(fn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: tokenKeys.all }),
  });
}

export function useCreateIntegrationToken() {
  return useTokenMutation((name: string) =>
    apiSend<IntegrationTokenCreated>("POST", "/integration-tokens", { name }),
  );
}

export function useRevokeIntegrationToken() {
  return useTokenMutation((id: string) =>
    apiSend<IntegrationToken>("DELETE", `/integration-tokens/${id}`),
  );
}
