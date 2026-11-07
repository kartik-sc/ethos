"use client";

import Link from "next/link";

import { SystemPill } from "@/components/system/system-pill";
import { primaryNav, settingsNav } from "@/lib/navigation";
import { cn } from "@/lib/utils";

import { EthosMark } from "./ethos-mark";
import { ThemeToggle } from "./theme-toggle";
import { WithActive } from "./with-active";

export function MobileTopBar() {
  const SettingsIcon = settingsNav.icon;

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-md md:hidden">
      <EthosMark className="size-5" />
      <span className="font-mono text-sm font-semibold tracking-tight">ethos</span>
      <div className="ml-auto flex items-center">
        <SystemPill compact />
        <ThemeToggle />
        <Link
          href={settingsNav.href}
          aria-label="Settings"
          className="inline-flex size-7 items-center justify-center rounded-md text-sidebar-foreground hover:text-foreground"
        >
          <SettingsIcon className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}

export function MobileNav() {
  const items = primaryNav.filter((item) => item.mobile);

  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <WithActive href={item.href}>
                {(active) => (
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-14 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="size-[1.125rem]" aria-hidden="true" />
                    {item.href === "/" ? "Home" : item.label}
                  </Link>
                )}
              </WithActive>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
