"use client";

import { ArrowUp } from "lucide-react";
import { type FormEvent, useState } from "react";

import { fieldClass } from "@/components/form-controls";
import { Button } from "@/components/ui/button";
import { useRunCommand } from "@/hooks/use-command";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

function isDuplicate(error: Error): boolean {
  return error instanceof ApiError && error.status === 409;
}

/** The phone's capture line: clear commands run, plain text goes to the Inbox. */
export function QuickCapture({ className }: { className?: string }) {
  const run = useRunCommand();
  const [text, setText] = useState("");
  const [sent, setSent] = useState("");

  function submit(event: FormEvent, confirmDuplicate = false) {
    event.preventDefault();
    const value = (confirmDuplicate ? sent : text).trim();
    if (!value) return;
    setSent(value);
    run.mutate(
      { text: value, confirm_duplicate: confirmDuplicate },
      { onSuccess: () => setText("") },
    );
  }

  return (
    <form onSubmit={submit} className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-2">
        <label htmlFor="quick-capture" className="sr-only">
          Capture
        </label>
        <input
          id="quick-capture"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            if (run.isError || run.isSuccess) run.reset();
          }}
          placeholder="Capture, or /task … by fri"
          autoComplete="off"
          enterKeyHint="send"
          className={cn(fieldClass, "h-11 flex-1 rounded-xl text-base")}
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send"
          disabled={!text.trim() || run.isPending}
          className="size-11 rounded-xl"
        >
          <ArrowUp aria-hidden="true" />
        </Button>
      </div>
      <p role="status" className="min-h-4 px-1 text-xs">
        {run.isSuccess && <span className="text-muted-foreground">{run.data.message}.</span>}
        {run.isError && isDuplicate(run.error) && (
          <span className="text-warning">
            Something like this already exists.{" "}
            <button
              type="button"
              onClick={(event) => submit(event, true)}
              className="font-medium underline underline-offset-2"
            >
              Add anyway
            </button>
          </span>
        )}
        {run.isError && !isDuplicate(run.error) && (
          <span className="text-destructive">{run.error.message}</span>
        )}
      </p>
    </form>
  );
}
