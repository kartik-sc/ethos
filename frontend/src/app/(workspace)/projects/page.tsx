import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { ProjectIndex } from "@/components/projects/project-index";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 md:px-10 md:py-14">
      <PageHeader
        title="Projects"
        description="Simple homes for related tasks and a deadline. Deleting one moves its tasks to Trash with it."
      />
      <ProjectIndex />
    </div>
  );
}
