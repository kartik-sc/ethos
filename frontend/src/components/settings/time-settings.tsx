"use client";

import { Check } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

import { fieldClass, labelClass } from "@/components/form-controls";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type AppPreferences,
  useAppPreferences,
  useUpdateAppPreferences,
} from "@/hooks/use-app-preferences";
import { cn } from "@/lib/utils";

const hhmm = (value: string) => value.slice(0, 5);

function timezones(current: string): string[] {
  const all = Intl.supportedValuesOf("timeZone");
  return all.includes(current) ? all : [current, ...all];
}

function TimeForm({ current }: { current: AppPreferences }) {
  const update = useUpdateAppPreferences();
  const zones = useMemo(() => timezones(current.timezone), [current.timezone]);
  const [timezone, setTimezone] = useState(current.timezone);
  const [minutes, setMinutes] = useState(String(current.default_task_minutes));
  const [starts, setStarts] = useState(hhmm(current.day_starts_at));
  const [ends, setEnds] = useState(hhmm(current.day_ends_at));

  const minuteValue = Number(minutes);
  const minutesValid = Number.isInteger(minuteValue) && minuteValue >= 5 && minuteValue <= 480;
  const windowValid = Boolean(starts && ends) && starts < ends;
  const changes: Partial<AppPreferences> = {
    ...(timezone !== current.timezone && { timezone }),
    ...(minutesValid &&
      minuteValue !== current.default_task_minutes && {
        default_task_minutes: minuteValue,
      }),
    ...(starts !== hhmm(current.day_starts_at) && { day_starts_at: starts }),
    ...(ends !== hhmm(current.day_ends_at) && { day_ends_at: ends }),
  };
  const changed = Object.keys(changes).length > 0;
  const valid = minutesValid && windowValid;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (changed && valid) update.mutate(changes);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pt-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={cn(labelClass, "sm:col-span-2")}>
          Timezone
          <select
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className={fieldClass}
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Default task duration (minutes)
          <input
            type="number"
            inputMode="numeric"
            min={5}
            max={480}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            aria-invalid={!minutesValid}
            className={cn(fieldClass, "font-mono text-xs")}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Day starts
            <input
              type="time"
              value={starts}
              onChange={(event) => setStarts(event.target.value)}
              aria-invalid={!windowValid}
              className={cn(fieldClass, "font-mono text-xs")}
            />
          </label>
          <label className={labelClass}>
            Day ends
            <input
              type="time"
              value={ends}
              onChange={(event) => setEnds(event.target.value)}
              aria-invalid={!windowValid}
              className={cn(fieldClass, "font-mono text-xs")}
            />
          </label>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Ethos only places work blocks inside the day window, in this timezone. Tasks without their
        own duration are scheduled with the default. Recurring blocks keep their local clock time
        when the timezone changes.
      </p>
      {!minutesValid && (
        <p className="text-xs text-destructive">Use a whole number of minutes from 5 to 480.</p>
      )}
      {!windowValid && (
        <p className="text-xs text-destructive">The day must start before it ends.</p>
      )}
      {update.isError && (
        <p role="alert" className="text-xs text-destructive">
          Couldn&apos;t save: {update.error.message}.
        </p>
      )}
      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={!changed || !valid || update.isPending}
        >
          {update.isSuccess && !changed ? <Check aria-hidden="true" /> : null}
          {update.isSuccess && !changed ? "Saved" : "Save"}
        </Button>
      </div>
    </form>
  );
}

export function TimeSettings() {
  const preferences = useAppPreferences();
  if (preferences.isPending) return <Skeleton className="mt-3 h-32 w-full" />;
  if (preferences.isError) {
    return (
      <p className="pt-3 text-xs text-destructive">Unavailable: {preferences.error.message}</p>
    );
  }
  return <TimeForm key={preferences.dataUpdatedAt} current={preferences.data} />;
}
