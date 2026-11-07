import { NotebookPen } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { NotesLibrary } from "@/components/notes/notes-library";

export const metadata: Metadata = { title: "Notes" };

export default function NotesPage() {
  return (
    <>
      <div className="md:hidden">
        <NotesLibrary />
      </div>
      <div className="m-auto hidden w-full max-w-md md:block">
        <EmptyState icon={NotebookPen} title="Pick a note">
          Choose a note from the library or start a new one. Notes are raw Markdown with
          [[wiki-links]], folders and tags.
        </EmptyState>
      </div>
    </>
  );
}
