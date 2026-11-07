"use client";

import { fieldClass, labelClass } from "@/components/form-controls";
import { useGoals } from "@/hooks/use-goals";
import type { GoalRef } from "@/lib/types/goals";

interface GoalSelectProps {
  value: string;
  onChange: (goalId: string) => void;
  /** The record's current goal, kept selectable even before the goal list loads. */
  current: GoalRef | null;
  className?: string;
}

export function GoalSelect({ value, onChange, current, className }: GoalSelectProps) {
  const goals = useGoals();
  const missingCurrent = current && !goals.data?.some((goal) => goal.id === current.id);

  return (
    <label className={className ?? labelClass}>
      Goal
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      >
        <option value="">None</option>
        {missingCurrent && <option value={current.id}>{current.title}</option>}
        {goals.data?.map((goal) => (
          <option key={goal.id} value={goal.id}>
            {goal.title}
          </option>
        ))}
      </select>
    </label>
  );
}
