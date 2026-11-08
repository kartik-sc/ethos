import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.calendar import habit_sessions, service
from app.calendar.schemas import (
    BlockRead,
    CalendarStatus,
    PlanRequest,
    PlanResult,
    RefreshResult,
    UnbookedSession,
)
from app.core.db import get_session
from app.preferences.service import get_preferences
from app.tasks.service import TaskNotFoundError, get_task

router = APIRouter(prefix="/calendar", tags=["calendar"])

SessionDep = Annotated[Session, Depends(get_session)]


def scheduling_context(session: SessionDep) -> service.Context:
    return service.Context.of(get_preferences(session), datetime.now(UTC))


ContextDep = Annotated[service.Context, Depends(scheduling_context)]


@router.get("/status")
def calendar_status(session: SessionDep, context: ContextDep) -> CalendarStatus:
    unbooked = [
        UnbookedSession(habit_id=item.habit_id, title=item.title, minutes=item.minutes)
        for item in habit_sessions.unbooked_today(session, context)
    ]
    return CalendarStatus(
        connected=False, pending=service.pending_count(session), unbooked=unbooked
    )


@router.post("/refresh")
def refresh(session: SessionDep, context: ContextDep) -> RefreshResult:
    """Settles past habit sessions and books today's and tomorrow's. The worker does the same
    every heartbeat; this runs it now, e.g. after a habit's session settings change."""
    report = habit_sessions.refresh(session, context, context.today + timedelta(days=1))
    return RefreshResult(
        done=report.done, missed=report.missed, recovered=report.recovered, booked=report.booked
    )


@router.get("/blocks")
def list_blocks(
    session: SessionDep,
    context: ContextDep,
    start: Annotated[date | None, Query()] = None,
    end: Annotated[date | None, Query()] = None,
) -> list[BlockRead]:
    """Blocks overlapping the local dates `start`…`end` (inclusive); today by default."""
    first = start or context.today
    last = end or first
    if last < first or last - first > timedelta(days=62):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Use a range of up to 62 days")
    window = service.local_range(first, last, context.timezone)
    return [service.read(block) for block in service.list_blocks(session, *window)]


@router.post(
    "/tasks/{task_id}/schedule",
    status_code=status.HTTP_201_CREATED,
    responses={
        404: {"description": "Task not found"},
        409: {"description": "Already scheduled, or no free slot (nothing is overbooked)"},
    },
)
def schedule_task(task_id: uuid.UUID, session: SessionDep, context: ContextDep) -> BlockRead:
    try:
        task = get_task(session, task_id)
    except TaskNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found") from None
    # Habit sessions are booked first so task work never takes their time.
    habit_sessions.refresh(session, context, context.today + timedelta(days=13))
    try:
        return service.read(service.schedule_task(session, task, context))
    except service.AlreadyScheduledError as scheduled:
        when = scheduled.block.starts_at.astimezone(ZoneInfo(context.timezone))
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Already scheduled for {when:%a %d %b, %H:%M}"
        ) from None
    except service.NoSlotError as no_slot:
        raise HTTPException(status.HTTP_409_CONFLICT, no_slot.message) from None


@router.post("/plan")
def plan(data: PlanRequest, session: SessionDep, context: ContextDep) -> PlanResult:
    """Previews (or with `apply`, creates) blocks for open tasks that are due within the
    horizon or have a duration. Existing blocks never move; what does not fit is listed."""
    through = context.today + timedelta(days=data.horizon_days - 1)
    habit_sessions.refresh(session, context, through)
    return service.plan_tasks(session, context, data.horizon_days, apply=data.apply)


@router.delete(
    "/blocks/{block_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"description": "Not found"}, 409: {"description": "External event"}},
)
def remove_block(block_id: uuid.UUID, session: SessionDep) -> None:
    try:
        service.remove_block(session, service.get_block(session, block_id))
    except service.BlockNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Block not found") from None
    except service.FixedBlockError:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Fixed: calendar events change in Google Calendar, and protected sessions stay",
        ) from None
