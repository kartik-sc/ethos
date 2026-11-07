"use client";

import { SquareTerminal } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCommandPalette } from "@/stores/command-palette";

/** The visible way into the palette, for touch screens and anyone who forgets Ctrl+K. */
export function CommandButton({ compact = false }: { compact?: boolean }) {
  const setOpen = useCommandPalette((state) => state.setOpen);

  if (compact) {
    return (
      <button
        type="button"
        aria-label="Open command palette"
        onClick={() => setOpen(true)}
        className="inline-flex size-7 items-center justify-center rounded-md text-sidebar-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <SquareTerminal className="size-4" aria-hidden="true" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-keyshortcuts="Control+K"
      className={cn(
        "flex h-8 w-full items-center gap-3 rounded-md border border-sidebar-border px-3 text-[0.8125rem] text-sidebar-foreground outline-none",
        "transition-colors hover:border-border-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
      )}
    >
      <SquareTerminal aria-hidden="true" className="size-4 shrink-0 text-faint" />
      <span>Command</span>
      <kbd className="ml-auto font-mono text-[0.625rem] text-faint">Ctrl K</kbd>
    </button>
  );
}
