import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCommandPalette } from "@/stores/command-palette";

import { CommandPalette } from "./command-palette";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const preview = {
  kind: "task",
  action: "Create task",
  fields: [{ label: "Title", value: "Write report" }],
  question: null,
  error: null,
  notes: [],
  duplicates: [],
  ready: true,
};

function renderPalette() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
    >
      <CommandPalette />
    </QueryClientProvider>,
  );
}

describe("CommandPalette", () => {
  beforeEach(() => {
    push.mockClear();
    useCommandPalette.setState({ open: false });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("opens with Ctrl+K, completes a command, previews and runs it", async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        url.endsWith("/preview")
          ? json(200, preview)
          : json(200, {
              kind: "task",
              message: "Task “Write report” created",
              record_kind: "task",
              record_id: "t1",
              query: null,
            }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderPalette();

    await userEvent.keyboard("{Control>}k{/Control}");
    const input = await screen.findByRole("combobox", { name: "Command" });
    await userEvent.type(input, "/ta");
    await userEvent.keyboard("{Tab}");
    expect(input).toHaveValue("/task ");

    await userEvent.type(input, "Write report");
    expect(await screen.findByText("Write report")).toBeInTheDocument();
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByText("Task “Write report” created")).toBeInTheDocument();
    const runCall = fetchMock.mock.calls.find(([url]) => url.endsWith("/run"));
    expect(JSON.parse((runCall as unknown as [string, RequestInit])[1].body as string)).toEqual({
      text: "/task Write report",
      confirm_duplicate: false,
    });
  });

  it("asks before creating a possible duplicate", async () => {
    const duplicate = { kind: "task", id: "t9", title: "Write report", due: null };
    // Preview flags the duplicate; run refuses until confirm_duplicate is sent.
    const fetchMock = vi.fn((url: string, init: RequestInit) => {
      if (url.endsWith("/preview"))
        return Promise.resolve(json(200, { ...preview, duplicates: [duplicate] }));
      const body = JSON.parse(init.body as string) as { confirm_duplicate: boolean };
      return Promise.resolve(
        body.confirm_duplicate
          ? json(200, {
              kind: "task",
              message: "Task created",
              record_kind: "task",
              record_id: "t2",
              query: null,
            })
          : json(409, { detail: "exists", duplicates: [duplicate] }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    useCommandPalette.setState({ open: true });
    renderPalette();

    const input = await screen.findByRole("combobox", { name: "Command" });
    await userEvent.type(input, "/task Write report");
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByText("Press Enter again to create it anyway.")).toBeInTheDocument();

    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByText("Task created")).toBeInTheDocument());
  });

  it("captures plain text to the Inbox on Enter", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json(200, {
        kind: "capture",
        message: "Added to the Inbox",
        record_kind: "inbox",
        record_id: "i1",
        query: null,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    useCommandPalette.setState({ open: true });
    renderPalette();

    await userEvent.type(
      await screen.findByRole("combobox", { name: "Command" }),
      "call the bank{Enter}",
    );

    expect(await screen.findByText("Added to the Inbox")).toBeInTheDocument();
    expect(
      JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string).text,
    ).toBe("call the bank");
  });
});
