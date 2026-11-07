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

async function request(
  method: string,
  path: string,
  init: { body?: unknown; signal?: AbortSignal },
): Promise<Response> {
  try {
    return await fetch(`${API_BASE}${path}`, {
      method,
      signal: init.signal,
      headers: {
        Accept: "application/json",
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("API unreachable", null);
  }
}

async function failure(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  const detail =
    body && typeof body === "object" && "detail" in body && typeof body.detail === "string"
      ? body.detail
      : `Request failed with ${response.status}`;
  return new ApiError(detail, response.status);
}

export async function apiGet<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await request("GET", path, { signal: options.signal });
  const accepted = response.ok || options.acceptStatuses?.includes(response.status);
  if (!accepted) throw await failure(response);
  return (await response.json()) as T;
}

export async function apiSend<T = void>(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await request(method, path, { body });
  if (!response.ok) throw await failure(response);
  return (response.status === 204 ? undefined : await response.json()) as T;
}
