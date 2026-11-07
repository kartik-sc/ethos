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
    expect(result.current.conflict?.theirs.content).toBe("their edit");
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

  it("sends its base and takes the server's merge when nothing was typed meanwhile", async () => {
    const merged = { ...base, content: "theirs + mine", version: 3, merged: true };
    const fetchMock = vi.fn().mockResolvedValue(json(200, merged));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useNoteDraft(base), { wrapper });

    act(() => result.current.setDraft({ ...result.current.draft, content: "mine" }));
    await act(() => result.current.save());

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ base_version: 1, base: { content: "v1" } });
    expect(result.current.draft.content).toBe("theirs + mine");
    expect(result.current.status).toBe("saved");
    expect(result.current.mergedAt).not.toBeNull();
  });

  it("merges by hand from the marked-up text and builds on the other version", async () => {
    const theirs = { ...base, content: "their line\n", version: 2 };
    const markers = "<<<<<<< yours\nmy line\n=======\ntheir line\n>>>>>>> other version\n";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json(409, { detail: "x", current: theirs, merged_with_markers: markers }),
      )
      .mockResolvedValueOnce(json(200, { ...theirs, content: "both lines\n", version: 3 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useNoteDraft(base), { wrapper });

    act(() => result.current.setDraft({ ...result.current.draft, content: "my line\n" }));
    await act(() => result.current.save());
    act(() => result.current.mergeByHand());

    expect(result.current.draft.content).toBe(markers);
    expect(result.current.status).toBe("dirty");

    act(() => result.current.setDraft({ ...result.current.draft, content: "both lines\n" }));
    await act(() => result.current.save());
    const body = JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ content: "both lines\n", base_version: 2 });
    expect(result.current.status).toBe("saved");
  });
});
