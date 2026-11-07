from datetime import datetime
from typing import Literal

from pydantic import BaseModel

CheckStatus = Literal["ok", "degraded", "down"]


class CheckResult(BaseModel):
    status: CheckStatus
    detail: str | None = None


class WorkerCheck(CheckResult):
    last_seen_at: datetime | None = None


class HealthChecks(BaseModel):
    database: CheckResult
    worker: WorkerCheck


class HealthReport(BaseModel):
    status: CheckStatus
    environment: str
    checked_at: datetime
    checks: HealthChecks


class LiveReport(BaseModel):
    status: Literal["ok"] = "ok"
