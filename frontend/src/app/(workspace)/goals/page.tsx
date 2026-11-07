import type { Metadata } from "next";

import { ModulePlaceholder, moduleTitle } from "@/components/module-placeholder";

export const metadata: Metadata = { title: moduleTitle("goals") };

export default function GoalsPage() {
  return <ModulePlaceholder module="goals" />;
}
