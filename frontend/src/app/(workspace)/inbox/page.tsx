import type { Metadata } from "next";

import { InboxBoard } from "@/components/inbox/inbox-board";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 md:px-10 md:py-14">
      <PageHeader
        title="Inbox"
        description="Unprocessed captures, oldest first. Turn each into a task, project or goal, or set it aside."
      />
      <InboxBoard />
    </div>
  );
}
