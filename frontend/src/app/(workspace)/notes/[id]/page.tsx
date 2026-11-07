import type { Metadata } from "next";
import { Suspense } from "react";

import { NoteEditor } from "@/components/notes/note-editor";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Note" };

async function NoteFromParams({ params }: { params: PageProps<"/notes/[id]">["params"] }) {
  const { id } = await params;
  return <NoteEditor id={id} />;
}

export default function NotePage({ params }: PageProps<"/notes/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-8 w-72" />}>
      <NoteFromParams params={params} />
    </Suspense>
  );
}
