from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.commands import service
from app.commands.interpreter import Interpreter, get_interpreter
from app.commands.schemas import CommandPreview, CommandRequest, CommandResult
from app.core.clock import local_today
from app.core.db import get_session
from app.preferences.deps import TimezoneDep

router = APIRouter(prefix="/commands", tags=["commands"])

SessionDep = Annotated[Session, Depends(get_session)]
InterpreterDep = Annotated[Interpreter, Depends(get_interpreter)]


@router.post("/preview")
def preview(
    data: CommandRequest, session: SessionDep, timezone: TimezoneDep, interpreter: InterpreterDep
) -> CommandPreview:
    """What Enter would do: parsed fields, one question if something essential is missing,
    and similar existing records. Writes nothing."""
    today = local_today(datetime.now(UTC), timezone)
    return service.preview(session, data.text, today, interpreter)


@router.post(
    "/run",
    responses={
        409: {"description": "Possible duplicates; resend with confirm_duplicate"},
        422: {"description": "Something essential is missing or doesn't match"},
    },
)
def run(
    data: CommandRequest, session: SessionDep, timezone: TimezoneDep, interpreter: InterpreterDep
) -> Any:
    now = datetime.now(UTC)
    today = local_today(now, timezone)
    try:
        result: CommandResult = service.run(
            session, data.text, today, now, interpreter, data.confirm_duplicate
        )
    except service.CommandRejectedError as rejected:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, rejected.message) from None
    except service.PossibleDuplicateError as duplicate:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=jsonable_encoder(
                {
                    "detail": "This looks like something that already exists",
                    "duplicates": duplicate.duplicates,
                }
            ),
        )
    return result
