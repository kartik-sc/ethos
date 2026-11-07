"use client";

import { Pin, PinOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePreferences } from "@/stores/preferences";

export function SidebarToggle() {
  const docked = usePreferences((state) => state.sidebarDocked);
  const toggle = usePreferences((state) => state.toggleSidebarDocked);

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-pressed={docked}
      aria-keyshortcuts="["
      aria-label={docked ? "Undock sidebar" : "Dock sidebar"}
      title={docked ? "Undock sidebar  [" : "Dock sidebar  ["}
      className="text-sidebar-foreground hover:text-foreground"
    >
      {/* Icons follow the <html> attribute so they are correct before hydration. */}
      <PinOff className="floating:hidden" />
      <Pin className="docked:hidden" />
    </Button>
  );
}
