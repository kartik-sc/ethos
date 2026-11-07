"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHealth } from "@/hooks/use-health";
import { summariseSystem } from "@/lib/system-status";
import { cn } from "@/lib/utils";

import { StatusDot } from "./status-dot";

export function SystemPill({ compact = false }: { compact?: boolean }) {
  const summary = summariseSystem(useHealth());

  return (
    <Tooltip disabled={!compact}>
      <TooltipTrigger
        render={<div role="status" />}
        className={cn(
          "flex h-8 min-w-0 items-center gap-2.5 rounded-md text-xs text-sidebar-foreground",
          compact ? "px-2" : "px-3",
        )}
      >
        <StatusDot tone={summary.tone} />
        <span className={cn("truncate", compact && "sr-only")}>{summary.label}</span>
      </TooltipTrigger>
      <TooltipContent side={compact ? "bottom" : "right"}>{summary.label}</TooltipContent>
    </Tooltip>
  );
}
