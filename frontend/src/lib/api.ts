const API_BASE = "/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  signal?: AbortSignal;
  /** Non-2xx statuses whose JSON body is still a valid typed response. */
  acceptStatuses?: readonly number[];
}

export async function apiGet<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      signal: options.signal,
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("API unreachable", null);
  }

  const accepted = response.ok || options.acceptStatuses?.includes(response.status);
  if (!accepted) {
    throw new ApiError(`Request failed with ${response.status}`, response.status);
  }
  return (await response.json()) as T;
}
