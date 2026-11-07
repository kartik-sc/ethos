"use client";

import { useInbox } from "@/hooks/use-inbox";

/** Open captures, shown beside the Inbox link so they are never out of sight. */
export function InboxCount() {
  const open = useInbox("open");
  const count = open.data?.length ?? 0;
  if (count === 0) return null;
  return (
    <span className="relative ml-auto rounded-full bg-primary/15 px-1.5 font-mono text-[0.625rem] leading-4 text-primary tabular-nums">
      {count}
      <span className="sr-only"> unprocessed</span>
    </span>
  );
}
