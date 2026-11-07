import type { Metadata } from "next";

import { ModulePlaceholder, moduleTitle } from "@/components/module-placeholder";

export const metadata: Metadata = { title: moduleTitle("analytics") };

export default function AnalyticsPage() {
  return <ModulePlaceholder module="analytics" />;
}
