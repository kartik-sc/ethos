import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { SearchView } from "@/components/search/search-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Search" };

async function SearchFromParams({
  searchParams,
}: {
  searchParams: PageProps<"/search">["searchParams"];
}) {
  const { q } = await searchParams;
  return <SearchView initialQuery={typeof q === "string" ? q : ""} />;
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 md:px-10 md:py-14">
      <PageHeader
        title="Search"
        description="One search across Ethos. Trashed records are left out; archived tasks are included."
      />
      <Suspense fallback={<Skeleton className="h-11 w-full rounded-xl" />}>
        <SearchFromParams searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
