import type { Metadata } from "next";

import { GoalIndex } from "@/components/goals/goal-index";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Goals" };

export default function GoalsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 md:px-10 md:py-14">
      <PageHeader
        title="Goals"
        description="Long-term objectives. Progress comes from the projects and tasks linked to each one."
      />
      <GoalIndex />
    </div>
  );
}
