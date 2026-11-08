import type { FileConflict } from "./types/files";

/** Matches backend/app/files/storage.py. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/** Short uppercase label from the extension, e.g. "PDF"; empty when there is none. */
export function fileBadge(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0 || dot === filename.length - 1) return "";
  return filename.slice(dot + 1, dot + 5).toUpperCase();
}

export function fileUrl(id: string): string {
  return `/api/v1/files/${id}/content`;
}

export function isFileConflict(body: unknown): body is FileConflict {
  return (
    typeof body === "object" &&
    body !== null &&
    "existing" in body &&
    typeof body.existing === "object" &&
    body.existing !== null &&
    "filename" in body.existing
  );
}
