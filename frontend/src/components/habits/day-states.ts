import type { DayState } from "@/lib/types/habits";

/** One colour language for every habit visual. Future days are drawn as outlines. */
export const dayFill: Record<DayState, string> = {
  met: "fill-primary",
  partial: "fill-warning/75",
  missed: "fill-destructive/50",
  pending: "fill-transparent stroke-primary/70",
  rest: "fill-muted",
  future: "fill-transparent stroke-border-strong",
  inactive: "fill-muted/40",
};

export const dayBackground: Record<DayState, string> = {
  met: "bg-primary",
  partial: "bg-warning/75",
  missed: "bg-destructive/50",
  pending: "border border-primary/70",
  rest: "bg-muted",
  future: "border border-border-strong",
  inactive: "bg-muted/40",
};

export const dayLabel: Record<DayState, string> = {
  met: "done",
  partial: "partly done",
  missed: "missed",
  pending: "not done yet",
  rest: "no entry expected",
  future: "upcoming",
  inactive: "before the habit started",
};
