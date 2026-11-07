import {
  type DefaultError,
  type QueryKey,
  useQuery as useTanstackQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

/** False while React hydrates server HTML, true on every render after that. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

/**
 * `useQuery`, but hydration always sees the state the server rendered (pending, fetching).
 * With streaming, a later boundary can hydrate after a shared query (the sidebar's health
 * check, say) already has data; reading it then would make the client markup disagree with
 * the server's. The real result arrives on the very next render.
 */
export function useQuery<
  TQueryFnData,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>): UseQueryResult<TData, TError> {
  const hydrated = useHydrated();
  const result = useTanstackQuery(options);
  if (hydrated) return result;
  return {
    ...result,
    data: undefined,
    error: null,
    status: "pending",
    fetchStatus: "fetching",
    isPending: true,
    isLoading: true,
    isFetching: true,
    isSuccess: false,
    isError: false,
    isLoadingError: false,
    isRefetchError: false,
    dataUpdatedAt: 0,
  } as UseQueryResult<TData, TError>;
}
