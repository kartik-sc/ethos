import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { usePreferences } from "@/stores/preferences";

import { SidebarToggle } from "./sidebar-toggle";

describe("SidebarToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.sidebar;
    usePreferences.setState({ sidebarDocked: false, sidebarOpen: false });
  });

  it("docks and undocks, persisting the mode on <html>", async () => {
    render(<SidebarToggle />);
    const dock = screen.getByRole("button", { name: "Dock sidebar" });
    expect(dock).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(dock);
    expect(document.documentElement.dataset.sidebar).toBe("docked");
    expect(localStorage.getItem("ethos-sidebar")).toBe("docked");

    await userEvent.click(screen.getByRole("button", { name: "Undock sidebar" }));
    expect(document.documentElement.dataset.sidebar).toBeUndefined();
    expect(localStorage.getItem("ethos-sidebar")).toBe("floating");
  });
});
