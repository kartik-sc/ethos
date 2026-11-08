import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Habit, HabitSummary } from "@/lib/types/habits";

import { LogButton, LogForm } from "./log-controls";

const TODAY = "2026-11-07";

function habit(overrides: Partial<Habit> = {}, summary: Partial<HabitSummary> = {}): Habit {
  return {
    id: "h1",
    title: "Read",
    description: null,
    area: null,
    cadence: "daily",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    times_per_week: null,
    measure: "check",
    unit: null,
    target_amount: null,
    protected: false,
    goal_id: null,
    goal: null,
    session_minutes: null,
    session_time: null,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    deleted_at: null,
    summary: {
      today: { date: TODAY, state: "pending", amount: null },
      today_log: null,
      streak: 0,
      streak_unit: "days",
      week_done: 0,
      week_target: 7,
      recent: [],
      ...summary,
    },
    ...overrides,
  };
}

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function respondWith(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("habit log controls", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("marks a check habit done for today with one tap", async () => {
    const fetchMock = respondWith(habit());
    renderWithClient(<LogButton habit={habit()} onOpenForm={vi.fn()} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Mark Read done today" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/v1/habits/h1/logs/${TODAY}`);
    expect(init.method).toBe("PUT");
  });

  it("undoes a done check habit by deleting the entry", async () => {
    const done = habit({}, { today: { date: TODAY, state: "met", amount: null } });
    const fetchMock = respondWith(habit());
    renderWithClient(<LogButton habit={done} onOpenForm={vi.fn()} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Undo Read for today" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].method).toBe("DELETE");
  });

  it("opens the form for amount habits instead of toggling", async () => {
    const onOpenForm = vi.fn();
    const leetcode = habit({
      title: "LeetCode",
      measure: "amount",
      unit: "min",
      target_amount: "120.00",
    });
    renderWithClient(<LogButton habit={leetcode} onOpenForm={onOpenForm} />);

    await userEvent.click(screen.getByRole("button", { name: "Log LeetCode for today" }));

    expect(onOpenForm).toHaveBeenCalledOnce();
  });

  it("sends the amount entered in the form", async () => {
    const leetcode = habit({
      title: "LeetCode",
      measure: "amount",
      unit: "min",
      target_amount: "120.00",
    });
    const fetchMock = respondWith(leetcode);
    const onClose = vi.fn();
    renderWithClient(<LogForm habit={leetcode} onClose={onClose} />);

    await userEvent.type(screen.getByRole("spinbutton", { name: "Amount (min)" }), "95");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body).toEqual({ amount: 95, start_time: null, end_time: null, note: null });
  });
});
