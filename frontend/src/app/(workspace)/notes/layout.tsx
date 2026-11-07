import type { ReactNode } from "react";

import { NotesLibrary } from "@/components/notes/notes-library";

export default function NotesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 border-r border-border bg-background/60 px-4 py-6 md:block md:floating:pt-16">
        <NotesLibrary />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col px-4 py-6 md:px-8 md:py-8">{children}</div>
    </div>
  );
}
