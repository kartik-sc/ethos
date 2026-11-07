import type { Metadata } from "next";

import { ModulePlaceholder, moduleTitle } from "@/components/module-placeholder";

export const metadata: Metadata = { title: moduleTitle("habits") };

export default function HabitsPage() {
  return <ModulePlaceholder module="habits" />;
}
