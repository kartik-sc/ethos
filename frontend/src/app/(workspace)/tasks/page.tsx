import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { TaskBoard } from "@/components/tasks/task-board";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 md:px-10 md:py-14">
      <PageHeader
        title="Tasks"
        description="Standalone work items. Deadlines and priority decide the Next Action on Home."
      />
      <TaskBoard />
    </div>
  );
}
