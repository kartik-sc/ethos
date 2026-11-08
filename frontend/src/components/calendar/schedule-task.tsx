"use client";

import { CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useScheduleTask } from "@/hooks/use-calendar";
import { useTimezone } from "@/hooks/use-timezone";
import { useToday } from "@/hooks/use-today";
import { formatSlot } from "@/lib/calendar";

/** Places one work block for the task in the earliest free slot; never overbooks. */
export function ScheduleTask({ taskId }: { taskId: string }) {
  const schedule = useScheduleTask();
  const timeZone = useTimezone();
  const today = useToday();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        disabled={schedule.isPending || schedule.isSuccess}
        onClick={() => schedule.mutate(taskId)}
      >
        <CalendarPlus aria-hidden="true" />
        Schedule
      </Button>
      <span role="status" className="text-xs">
        {schedule.isSuccess && timeZone && today && (
          <span className="text-muted-foreground">
            Blocked {formatSlot(schedule.data.starts_at, schedule.data.ends_at, timeZone, today)}
          </span>
        )}
        {schedule.isError && <span className="text-destructive">{schedule.error.message}.</span>}
      </span>
    </div>
  );
}
