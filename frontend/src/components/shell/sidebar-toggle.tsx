"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePreferences } from "@/stores/preferences";

export function SidebarToggle() {
  const collapsed = usePreferences((state) => state.sidebarCollapsed);
  const toggle = usePreferences((state) => state.toggleSidebar);

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-controls="sidebar"
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="text-sidebar-foreground hover:text-foreground"
    >
      {/* Icons follow the <html> attribute so they are correct before hydration. */}
      <PanelLeftClose className="collapsed:hidden" />
      <PanelLeftOpen className="expanded:hidden" />
    </Button>
  );
}
