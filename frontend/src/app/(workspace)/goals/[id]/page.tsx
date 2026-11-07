import type { Metadata } from "next";
import { Suspense } from "react";

import { GoalDetail } from "@/components/goals/goal-detail";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Goal" };

async function GoalFromParams({ params }: { params: PageProps<"/goals/[id]">["params"] }) {
  const { id } = await params;
  return <GoalDetail id={id} />;
}

export default function GoalPage({ params }: PageProps<"/goals/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-8 md:px-10 md:py-14">
      <Suspense fallback={<Skeleton className="h-8 w-72" />}>
        <GoalFromParams params={params} />
      </Suspense>
    </div>
  );
}
