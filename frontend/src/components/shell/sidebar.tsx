"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SystemPill } from "@/components/system/system-pill";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isActive, type NavItem, primaryNav, settingsNav } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/stores/preferences";

import { EthosMark } from "./ethos-mark";
import { SidebarToggle } from "./sidebar-toggle";
import { ThemeToggle } from "./theme-toggle";

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const collapsed = usePreferences((state) => state.sidebarCollapsed);
  const Icon = item.icon;

  return (
    <Tooltip disabled={!collapsed}>
      <TooltipTrigger
        render={<Link href={item.href} aria-current={active ? "page" : undefined} />}
        className={cn(
          "group relative flex h-8 items-center gap-3 rounded-md px-3 text-[0.8125rem] font-medium outline-none",
          "text-sidebar-foreground transition-colors hover:text-sidebar-accent-foreground",
          "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          active && "text-sidebar-accent-foreground",
        )}
      >
        {active && (
          <motion.span
            layoutId="sidebar-active"
            className="absolute inset-0 rounded-md bg-sidebar-accent"
            transition={{ type: "spring", stiffness: 520, damping: 40 }}
          >
            <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-primary" />
          </motion.span>
        )}
        <Icon
          aria-hidden="true"
          className={cn(
            "relative size-4 shrink-0 transition-colors",
            active ? "text-primary" : "text-faint group-hover:text-sidebar-accent-foreground",
          )}
        />
        <span className="relative truncate transition-opacity duration-200 collapsed:opacity-0">
          {item.label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      id="sidebar"
      className={cn(
        "sticky top-0 hidden h-dvh w-58 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar md:flex",
        "transition-[width] duration-300 ease-out-quint motion-reduce:transition-none collapsed:w-15",
      )}
    >
      <div className="flex h-14 items-center gap-2.5 px-4.5">
        <EthosMark className="shrink-0" />
        <span className="font-mono text-sm font-semibold tracking-tight transition-opacity duration-200 collapsed:opacity-0">
          ethos
        </span>
      </div>

      <nav aria-label="Primary" className="flex flex-1 flex-col gap-0.5 px-2 pt-2">
        <p className="micro-label px-3 pb-2 transition-opacity duration-200 collapsed:opacity-0">
          Workspace
        </p>
        {primaryNav.map((item) => (
          <SidebarLink key={item.href} item={item} active={isActive(item.href, pathname)} />
        ))}
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-sidebar-border px-2 py-2">
        <SidebarLink item={settingsNav} active={isActive(settingsNav.href, pathname)} />
        <SystemPill />
        <div className="flex items-center gap-1 px-1 pt-1 collapsed:flex-col">
          <SidebarToggle />
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
