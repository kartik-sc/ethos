"use client";

import { motion } from "motion/react";

import { cn } from "@/lib/utils";

interface ViewTabsProps<T extends string> {
  label: string;
  views: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function ViewTabs<T extends string>({ label, views, value, onChange }: ViewTabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className="flex items-center gap-1">
      {views.map((view) => {
        const selected = view.value === value;
        return (
          <button
            key={view.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(view.value)}
            className={cn(
              "relative h-7 rounded-md px-3 text-xs font-medium transition-colors outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring",
              selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {selected && (
              <motion.span
                layoutId={`view-tabs-${label}`}
                className="absolute inset-0 rounded-md bg-accent"
                transition={{ type: "spring", stiffness: 520, damping: 40 }}
              />
            )}
            <span className="relative">{view.label}</span>
          </button>
        );
      })}
    </div>
  );
}
