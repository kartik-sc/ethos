import type { Metadata } from "next";
import { Suspense } from "react";

import { ProjectDetail } from "@/components/projects/project-detail";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Project" };

async function ProjectFromParams({ params }: { params: PageProps<"/projects/[id]">["params"] }) {
  const { id } = await params;
  return <ProjectDetail id={id} />;
}

export default function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-8 md:px-10 md:py-14">
      <Suspense fallback={<Skeleton className="h-8 w-72" />}>
        <ProjectFromParams params={params} />
      </Suspense>
    </div>
  );
}
