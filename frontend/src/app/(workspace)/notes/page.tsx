import type { Metadata } from "next";

import { ModulePlaceholder, moduleTitle } from "@/components/module-placeholder";

export const metadata: Metadata = { title: moduleTitle("notes") };

export default function NotesPage() {
  return <ModulePlaceholder module="notes" />;
}
