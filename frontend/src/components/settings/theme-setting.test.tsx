import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { usePreferences } from "@/stores/preferences";

import { ThemeSetting } from "./theme-setting";

describe("ThemeSetting", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "dark";
    usePreferences.setState({ theme: "dark" });
  });

  it("switches to light, updates <html> and remembers the choice", async () => {
    render(<ThemeSetting />);
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");

    await userEvent.click(screen.getByRole("radio", { name: "Light" }));

    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem("ethos-theme")).toBe("light");
    expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
  });
});
