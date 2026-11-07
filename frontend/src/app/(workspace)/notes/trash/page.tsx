import type { Metadata } from "next";

import { NotesTrash } from "@/components/notes/notes-trash";

export const metadata: Metadata = { title: "Notes Trash" };

export default function NotesTrashPage() {
  return <NotesTrash />;
}
