import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Note } from "@/lib/types/notes";

import { useNoteDraft } from "./use-note-draft";

const base: Note = {
  id: "n1",
  title: "Plan",
  content: "v1",
  folder_id: null,
  tags: [],
  updated_at: "2026-11-07T10:00:00Z",
  deleted_at: null,
  version: 1,
  created_at: "2026-11-07T10:00:00Z",
  links: [],
  backlinks: [],
};

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("useNoteDraft", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("tracks unsaved changes and clears them after a save", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json(200, { ...base, content: "v2", version: 2 })),
    );
    const { result } = renderHook(() => useNoteDraft(base), { wrapper });

    act(() => result.current.setDraft({ ...result.current.draft, content: "v2" }));
    expect(result.current.status).toBe("dirty");

    await act(() => result.current.save());
    expect(result.current.status).toBe("saved");
    expect(result.current.saved.version).toBe(2);
  });

  it("keeps the draft on a conflict and overwrites only on request, preserving theirs", async () => {
    const theirs = { ...base, content: "their edit", version: 2 };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json(409, { detail: "This note changed since you opened it", current: theirs }),
      )
      .mockResolvedValueOnce(json(200, { ...base, content: "my edit", version: 3 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useNoteDraft(base), { wrapper });

    act(() => result.current.setDraft({ ...result.current.draft, content: "my edit" }));
    await act(() => result.current.save());

    expect(result.current.status).toBe("conflict");
    expect(result.current.conflict?.content).toBe("their edit");
    expect(result.current.draft.content).toBe("my edit");

    act(() => result.current.keepMine());
    await waitFor(() => expect(result.current.status).toBe("saved"));
    const body = JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ content: "my edit", base_version: 2, preserve_current: true });
  });

  it("keeps the draft and reports an error when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const { result, unmount } = renderHook(() => useNoteDraft(base), { wrapper });

    act(() => result.current.setDraft({ ...result.current.draft, content: "precious" }));
    await act(() => result.current.save());

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("API unreachable");
    expect(result.current.draft.content).toBe("precious");
    unmount();
  });
});
