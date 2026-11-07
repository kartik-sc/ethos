"use client";

import { type FormEvent, useState } from "react";

import { fieldClass, labelClass } from "@/components/form-controls";
import { GoalSelect } from "@/components/goals/goal-select";
import { Button } from "@/components/ui/button";
import { WEEKDAY_LETTERS } from "@/lib/habits";
import { LIFE_AREAS } from "@/lib/tasks";
import type { Cadence, Habit, HabitInput, Measure } from "@/lib/types/habits";
import type { LifeArea } from "@/lib/types/tasks";
import { cn } from "@/lib/utils";

const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const measures: { value: Measure; label: string; hint: string }[] = [
  { value: "check", label: "Done / not done", hint: "One tap a day" },
  { value: "amount", label: "Amount", hint: "Minutes, pages, kg…" },
  { value: "span", label: "Time span", hint: "Bedtime → wake time" },
];

interface Draft {
  title: string;
  description: string;
  area: LifeArea | "";
  cadence: Cadence;
  weekdays: number[];
  timesPerWeek: string;
  measure: Measure;
  unit: string;
  target: string;
  protected: boolean;
  goalId: string;
}

function toDraft(habit?: Habit): Draft {
  return {
    title: habit?.title ?? "",
    description: habit?.description ?? "",
    area: habit?.area ?? "",
    cadence: habit?.cadence ?? "daily",
    weekdays: habit?.weekdays ?? [0, 1, 2, 3, 4, 5, 6],
    timesPerWeek: String(habit?.times_per_week ?? 3),
    measure: habit?.measure ?? "check",
    unit: habit?.measure === "amount" ? (habit.unit ?? "") : "",
    target: habit?.target_amount ? String(Number(habit.target_amount)) : "",
    protected: habit?.protected ?? false,
    goalId: habit?.goal?.id ?? "",
  };
}

export function toInput(draft: Draft): HabitInput {
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    area: draft.area || null,
    cadence: draft.cadence,
    weekdays: draft.cadence === "daily" ? draft.weekdays : null,
    times_per_week: draft.cadence === "weekly" ? Number(draft.timesPerWeek) : null,
    measure: draft.measure,
    unit: draft.measure === "amount" ? draft.unit.trim() : null,
    target_amount: draft.measure !== "check" && draft.target ? Number(draft.target) : null,
    protected: draft.protected,
    goal_id: draft.goalId || null,
  };
}

function draftProblem(draft: Draft): string | null {
  if (!draft.title.trim()) return "Give the habit a name.";
  if (draft.cadence === "daily" && draft.weekdays.length === 0) return "Pick at least one day.";
  if (draft.measure === "amount" && !draft.unit.trim()) return "Add a unit, such as min or pages.";
  return null;
}

interface HabitFormProps {
  habit?: Habit;
  submitLabel: string;
  pending: boolean;
  error: Error | null;
  onSubmit: (input: HabitInput) => void;
  onCancel: () => void;
}

export function HabitForm({
  habit,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: HabitFormProps) {
  const [draft, setDraft] = useState(() => toDraft(habit));
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const problem = draftProblem(draft);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (problem || pending) return;
    onSubmit(toInput(draft));
  }

  function toggleDay(day: number) {
    set(
      "weekdays",
      draft.weekdays.includes(day)
        ? draft.weekdays.filter((existing) => existing !== day)
        : [...draft.weekdays, day].sort(),
    );
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => event.key === "Escape" && onCancel()}
      aria-label={habit ? `Edit ${habit.title}` : "New habit"}
      className="flex flex-col gap-4"
    >
      <label className={labelClass}>
        Name
        <input
          autoFocus
          maxLength={200}
          value={draft.title}
          onChange={(event) => set("title", event.target.value)}
          placeholder="Read, Gym, Sleep…"
          className={fieldClass}
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-xs text-muted-foreground">Repeats</legend>
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Repeat pattern"
            value={draft.cadence}
            onChange={(event) => set("cadence", event.target.value as Cadence)}
            className={cn(fieldClass, "w-auto")}
          >
            <option value="daily">On chosen days</option>
            <option value="weekly">Times per week</option>
          </select>
          {draft.cadence === "daily" ? (
            <div role="group" aria-label="Days" className="flex gap-1">
              {WEEKDAY_LETTERS.map((letter, day) => {
                const on = draft.weekdays.includes(day);
                return (
                  <button
                    key={WEEKDAY_NAMES[day]}
                    type="button"
                    aria-pressed={on}
                    aria-label={WEEKDAY_NAMES[day]}
                    onClick={() => toggleDay(day)}
                    className={cn(
                      "size-8 rounded-md font-mono text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      on
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          ) : (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="number"
                min={1}
                max={7}
                value={draft.timesPerWeek}
                onChange={(event) => set("timesPerWeek", event.target.value)}
                className={cn(fieldClass, "w-16 font-mono text-xs")}
              />
              times a week, any days
            </label>
          )}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-xs text-muted-foreground">Track</legend>
        <div role="radiogroup" aria-label="Measure" className="grid gap-2 sm:grid-cols-3">
          {measures.map((option) => {
            const selected = draft.measure === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => set("measure", option.value)}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "border-primary/70 bg-primary/10"
                    : "border-border hover:border-border-strong",
                )}
              >
                <span className="text-sm">{option.label}</span>
                <span className="text-[0.6875rem] text-muted-foreground">{option.hint}</span>
              </button>
            );
          })}
        </div>
        {draft.measure !== "check" && (
          <div className="flex flex-wrap gap-3">
            {draft.measure === "amount" && (
              <label className={labelClass}>
                Unit
                <input
                  maxLength={16}
                  value={draft.unit}
                  onChange={(event) => set("unit", event.target.value)}
                  placeholder="min"
                  className={cn(fieldClass, "w-28")}
                />
              </label>
            )}
            <label className={labelClass}>
              {draft.measure === "span" ? "Target hours (optional)" : "Target per entry (optional)"}
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={draft.target}
                onChange={(event) => set("target", event.target.value)}
                className={cn(fieldClass, "w-36 font-mono text-xs")}
              />
            </label>
          </div>
        )}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <GoalSelect
          value={draft.goalId}
          onChange={(goalId) => set("goalId", goalId)}
          current={habit?.goal ?? null}
        />
        <label className={labelClass}>
          Area
          <select
            value={draft.area}
            onChange={(event) => set("area", event.target.value as LifeArea | "")}
            className={fieldClass}
          >
            <option value="">None</option>
            {LIFE_AREAS.map((area) => (
              <option key={area.value} value={area.value}>
                {area.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={draft.protected}
          onChange={(event) => set("protected", event.target.checked)}
          className="mt-0.5 size-4 accent-primary"
        />
        <span>
          Protected commitment
          <span className="block text-xs text-muted-foreground">
            Listed first and treated as a fixed commitment, never a flexible one.
          </span>
        </span>
      </label>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          Couldn&apos;t save: {error.message}. Your changes are still here.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {problem && draft.title && (
          <span className="mr-auto text-xs text-muted-foreground">{problem}</span>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={Boolean(problem) || pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
