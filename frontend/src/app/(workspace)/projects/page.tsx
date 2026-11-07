import type { Metadata } from "next";

import { ModulePlaceholder, moduleTitle } from "@/components/module-placeholder";

export const metadata: Metadata = { title: moduleTitle("projects") };

export default function ProjectsPage() {
  return <ModulePlaceholder module="projects" />;
}
