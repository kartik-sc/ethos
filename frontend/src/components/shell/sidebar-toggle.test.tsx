import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { usePreferences } from "@/stores/preferences";

import { SidebarToggle } from "./sidebar-toggle";

describe("SidebarToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.sidebar;
    usePreferences.setState({ sidebarCollapsed: false });
  });

  it("collapses and expands, persisting the state on <html>", async () => {
    render(<SidebarToggle />);
    const button = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(button).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(button);
    expect(document.documentElement.dataset.sidebar).toBe("collapsed");
    expect(localStorage.getItem("ethos-sidebar")).toBe("collapsed");
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    await userEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(document.documentElement.dataset.sidebar).toBeUndefined();
  });
});
