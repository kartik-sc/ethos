import type { Metadata } from "next";

import { ModulePlaceholder, moduleTitle } from "@/components/module-placeholder";

export const metadata: Metadata = { title: moduleTitle("inbox") };

export default function InboxPage() {
  return <ModulePlaceholder module="inbox" />;
}
