"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePreferences } from "@/stores/preferences";

export function ThemeToggle() {
  const theme = usePreferences((state) => state.theme);
  const setTheme = usePreferences((state) => state.setTheme);
  const next = theme === "dark" ? "light" : "dark";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      className="text-sidebar-foreground hover:text-foreground"
    >
      {/* Icon follows the <html> class so it is correct before hydration. */}
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}
