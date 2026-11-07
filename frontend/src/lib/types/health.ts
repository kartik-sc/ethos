// Mirrors app/system/schemas.py. Replace with generated OpenAPI types once the API grows.
export type CheckStatus = "ok" | "degraded" | "down";

export interface CheckResult {
  status: CheckStatus;
  detail: string | null;
}

export interface WorkerCheck extends CheckResult {
  last_seen_at: string | null;
}

export interface HealthReport {
  status: CheckStatus;
  environment: string;
  checked_at: string;
  checks: {
    database: CheckResult;
    worker: WorkerCheck;
  };
}
