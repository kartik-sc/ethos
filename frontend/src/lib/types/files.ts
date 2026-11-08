// Mirrors backend/app/files/schemas.py.
export type FileView = "active" | "trash";

export interface FileAsset {
  id: string;
  project_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface FileConflict {
  detail: string;
  existing: FileAsset;
}
