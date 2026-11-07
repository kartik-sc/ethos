import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuickAdd } from "./quick-add";

function renderQuickAdd() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <QuickAdd />
    </QueryClientProvider>,
  );
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("QuickAdd", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts a trimmed title with the chosen priority and clears the input", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { id: "t1" }));
    vi.stubGlobal("fetch", fetchMock);
    renderQuickAdd();

    const input = screen.getByRole("textbox", { name: "New task" });
    await userEvent.type(input, "  Finish DBMS assignment  ");
    await userEvent.click(screen.getByRole("button", { name: /change priority/i }));
    await userEvent.type(input, "{Enter}");

    await waitFor(() => expect(input).toHaveValue(""));
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/tasks");
    expect(JSON.parse(init.body as string)).toEqual({
      title: "Finish DBMS assignment",
      priority: "high",
      due_date: null,
      project_id: null,
      goal_id: null,
    });
  });

  it("keeps the text and explains when saving fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    renderQuickAdd();

    const input = screen.getByRole("textbox", { name: "New task" });
    await userEvent.type(input, "Call the bank{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("API unreachable");
    expect(input).toHaveValue("Call the bank");
  });

  it("does not submit a blank title", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderQuickAdd();

    await userEvent.type(screen.getByRole("textbox", { name: "New task" }), "   {Enter}");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });
});
