"use client";

import { Check } from "lucide-react";
import { type FormEvent, useState } from "react";

import { fieldClass } from "@/components/form-controls";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type AppPreferences,
  useAppPreferences,
  useUpdateAppPreferences,
} from "@/hooks/use-app-preferences";
import { cn } from "@/lib/utils";

function ArchiveForm({ current }: { current: AppPreferences }) {
  const update = useUpdateAppPreferences();
  const [days, setDays] = useState(String(current.archive_after_days));
  const value = Number(days);
  const valid = Number.isInteger(value) && value >= 1 && value <= 365;
  const changed = valid && value !== current.archive_after_days;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (changed) update.mutate({ archive_after_days: value });
  }

  return (
    <form onSubmit={submit} className="flex flex-col items-start gap-1.5 sm:items-end">
      <div className="flex items-center gap-2">
        <label htmlFor="archive-days" className="sr-only">
          Days before archiving
        </label>
        <input
          id="archive-days"
          type="number"
          inputMode="numeric"
          min={1}
          max={365}
          value={days}
          onChange={(event) => setDays(event.target.value)}
          aria-invalid={!valid}
          className={cn(fieldClass, "w-20 font-mono text-xs")}
        />
        <span className="text-xs text-muted-foreground">days</span>
        <Button type="submit" size="sm" variant="outline" disabled={!changed || update.isPending}>
          {update.isSuccess && !changed ? <Check aria-hidden="true" /> : null}
          {update.isSuccess && !changed ? "Saved" : "Save"}
        </Button>
      </div>
      {!valid && <p className="text-xs text-destructive">Use a whole number from 1 to 365.</p>}
      {update.isError && (
        <p role="alert" className="text-xs text-destructive">
          Couldn&apos;t save: {update.error.message}.
        </p>
      )}
    </form>
  );
}

export function ArchiveSetting() {
  const preferences = useAppPreferences();
  if (preferences.isPending) return <Skeleton className="h-8 w-48" />;
  if (preferences.isError) {
    return <p className="text-xs text-destructive">Unavailable: {preferences.error.message}</p>;
  }
  return <ArchiveForm current={preferences.data} />;
}
