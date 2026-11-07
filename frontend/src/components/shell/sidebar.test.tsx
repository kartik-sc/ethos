import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { usePreferences } from "@/stores/preferences";

import { Sidebar } from "./sidebar";

const push = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => "/tasks", useRouter: () => ({ push }) }));

function renderSidebar() {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <Sidebar />
        <input aria-label="Somewhere to type" />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("Sidebar", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.sidebar;
    usePreferences.setState({ sidebarDocked: false, sidebarOpen: false });
  });

  it("floats hidden by default and opens from the launcher", async () => {
    renderSidebar();
    const aside = document.getElementById("sidebar");
    expect(aside).toHaveAttribute("inert");

    await userEvent.click(screen.getByRole("button", { name: /open navigation/i }));

    expect(aside).not.toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: /open navigation/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("closes on Escape", async () => {
    renderSidebar();
    await userEvent.click(screen.getByRole("button", { name: /open navigation/i }));
    await userEvent.tab();
    await userEvent.keyboard("{Escape}");

    expect(usePreferences.getState().sidebarOpen).toBe(false);
    expect(screen.getByRole("button", { name: /open navigation/i })).toHaveFocus();
  });

  it("docks with [ but not while typing", async () => {
    renderSidebar();

    await userEvent.click(screen.getByRole("textbox", { name: "Somewhere to type" }));
    await userEvent.keyboard("[[");
    expect(usePreferences.getState().sidebarDocked).toBe(false);

    await userEvent.click(document.body);
    await userEvent.keyboard("[[");
    expect(usePreferences.getState().sidebarDocked).toBe(true);
    expect(document.getElementById("sidebar")).not.toHaveAttribute("inert");
  });

  it("opens search with / unless typing", async () => {
    push.mockClear();
    renderSidebar();

    await userEvent.click(screen.getByRole("textbox", { name: "Somewhere to type" }));
    await userEvent.keyboard("/");
    expect(push).not.toHaveBeenCalled();

    await userEvent.click(document.body);
    await userEvent.keyboard("/");
    expect(push).toHaveBeenCalledWith("/search");
  });
});
