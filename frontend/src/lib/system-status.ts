import { ApiError } from "@/lib/api";
import type { CheckStatus, HealthReport } from "@/lib/types/health";

export type SignalTone = CheckStatus | "pending";

export interface Signal {
  name: "API" | "Database" | "Worker";
  tone: SignalTone;
  detail: string;
}

export interface SystemSummary {
  tone: SignalTone;
  label: string;
  signals: readonly Signal[];
}

interface HealthQueryState {
  data: HealthReport | undefined;
  error: unknown;
  isPending: boolean;
}

const unknown = (name: Signal["name"]): Signal => ({ name, tone: "pending", detail: "Unknown" });

export function summariseSystem({ data, error, isPending }: HealthQueryState): SystemSummary {
  if (data) {
    const { database, worker } = data.checks;
    const label =
      data.status === "ok"
        ? "All systems normal"
        : database.status === "down"
          ? "Database unreachable"
          : "Worker not reporting";
    return {
      tone: data.status,
      label,
      signals: [
        { name: "API", tone: "ok", detail: "Responding" },
        { name: "Database", tone: database.status, detail: database.detail ?? "Connected" },
        { name: "Worker", tone: worker.status, detail: worker.detail ?? "Reporting" },
      ],
    };
  }

  if (error) {
    const detail =
      error instanceof ApiError && error.status !== null ? `HTTP ${error.status}` : "No response";
    return {
      tone: "down",
      label: "API unreachable",
      signals: [{ name: "API", tone: "down", detail }, unknown("Database"), unknown("Worker")],
    };
  }

  return {
    tone: "pending",
    label: isPending ? "Checking systems" : "Status unavailable",
    signals: [unknown("API"), unknown("Database"), unknown("Worker")],
  };
}
