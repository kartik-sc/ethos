import type { Metadata } from "next";

import { ModulePlaceholder, moduleTitle } from "@/components/module-placeholder";

export const metadata: Metadata = { title: moduleTitle("tasks") };

export default function TasksPage() {
  return <ModulePlaceholder module="tasks" />;
}
