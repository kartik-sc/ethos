import type { Metadata } from "next";

import { AnalyticsView } from "@/components/analytics/analytics-view";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 md:px-10 md:py-14">
      <PageHeader
        title="Analytics"
        description="What happened, week by week and month by month. Numbers and plain facts only."
      />
      <AnalyticsView />
    </div>
  );
}
