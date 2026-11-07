/** Mirrors the backend limits in app/notes/schemas.py. */
export const MAX_IMPORT_FILES = 500;
export const MAX_NOTE_LENGTH = 500_000;
const MARKDOWN = /\.(md|markdown)$/i;

export interface PickedFile {
  /** Path inside a picked folder ("Vault/CS/Graphs.md"), or just the file name. */
  path: string;
  text: string;
}

export interface ImportPlan {
  files: { path: string; content: string }[];
  /** Left out before upload, with the reason, so the summary can say so. */
  skipped: { path: string; reason: string }[];
}

export function planImport(picked: readonly PickedFile[]): ImportPlan {
  const plan: ImportPlan = { files: [], skipped: [] };
  for (const file of picked) {
    if (!MARKDOWN.test(file.path)) {
      plan.skipped.push({ path: file.path, reason: "Not a Markdown file" });
    } else if (file.text.length > MAX_NOTE_LENGTH) {
      plan.skipped.push({ path: file.path, reason: "Larger than 500,000 characters" });
    } else if (plan.files.length >= MAX_IMPORT_FILES) {
      plan.skipped.push({
        path: file.path,
        reason: `Over ${MAX_IMPORT_FILES} files in one import`,
      });
    } else {
      plan.files.push({ path: file.path, content: file.text });
    }
  }
  return plan;
}

export async function readPicked(list: FileList): Promise<PickedFile[]> {
  return Promise.all(
    Array.from(list, async (file) => ({
      path: file.webkitRelativePath || file.name,
      text: MARKDOWN.test(file.name) ? await file.text() : "",
    })),
  );
}

interface DirectoryHandle {
  getDirectoryHandle(name: string, options: { create: boolean }): Promise<DirectoryHandle>;
  getFileHandle(
    name: string,
    options: { create: boolean },
  ): Promise<{
    createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
  }>;
}

type DirectoryPicker = (options: { mode: "readwrite" }) => Promise<DirectoryHandle>;

/** Writes files under a folder the owner picks (Chrome, Edge); null where unsupported. */
export function directoryPicker(): DirectoryPicker | null {
  const picker = (window as unknown as { showDirectoryPicker?: DirectoryPicker })
    .showDirectoryPicker;
  return typeof picker === "function" ? picker.bind(window) : null;
}

export async function writeToDirectory(
  root: DirectoryHandle,
  files: readonly { path: string; content: string }[],
): Promise<void> {
  for (const file of files) {
    const parts = file.path.split("/");
    const name = parts.pop() ?? "note.md";
    let directory = root;
    for (const part of parts)
      directory = await directory.getDirectoryHandle(part, { create: true });
    const writable = await (await directory.getFileHandle(name, { create: true })).createWritable();
    await writable.write(file.content);
    await writable.close();
  }
}

/** Fallback: one download per note, named after its path. */
export function downloadEach(files: readonly { path: string; content: string }[]): void {
  for (const file of files) {
    const url = URL.createObjectURL(
      new Blob([file.content], { type: "text/markdown;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.path.replaceAll("/", " - ");
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
