import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.commands.interpreter import Interpreter, get_interpreter
from app.core.clock import local_today
from app.core.db import get_session
from app.integrations import service
from app.integrations.schemas import (
    CaptureRequest,
    CaptureResult,
    TokenCreate,
    TokenCreated,
    TokenRead,
)
from app.preferences.deps import TimezoneDep

router = APIRouter(tags=["integrations"])

SessionDep = Annotated[Session, Depends(get_session)]
UNAUTHORIZED = HTTPException(
    status.HTTP_401_UNAUTHORIZED,
    "Missing, unknown or revoked capture token",
    headers={"WWW-Authenticate": "Bearer"},
)


def require_capture_token(
    session: SessionDep, authorization: Annotated[str | None, Header()] = None
) -> None:
    scheme, _, raw = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not raw:
        raise UNAUTHORIZED
    if service.authenticate(session, raw.strip(), datetime.now(UTC)) is None:
        raise UNAUTHORIZED


@router.get("/integration-tokens")
def list_tokens(session: SessionDep) -> list[TokenRead]:
    return [TokenRead.model_validate(token) for token in service.list_tokens(session)]


@router.post("/integration-tokens", status_code=status.HTTP_201_CREATED)
def create_token(data: TokenCreate, session: SessionDep) -> TokenCreated:
    token, raw = service.create_token(session, data.name)
    return TokenCreated(**TokenRead.model_validate(token).model_dump(), token=raw)


@router.delete("/integration-tokens/{token_id}", responses={404: {"description": "Not found"}})
def revoke_token(token_id: uuid.UUID, session: SessionDep) -> TokenRead:
    try:
        return TokenRead.model_validate(service.revoke_token(session, token_id, datetime.now(UTC)))
    except service.TokenNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Token not found") from None


@router.post(
    "/capture",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_capture_token)],
    responses={401: {"description": "Missing, unknown or revoked token"}},
)
def capture(
    data: CaptureRequest,
    session: SessionDep,
    timezone: TimezoneDep,
    interpreter: Annotated[Interpreter, Depends(get_interpreter)],
) -> CaptureResult:
    """Capture from a trusted client (an iPhone Shortcut) with `Authorization: Bearer <token>`.

    201 means the capture is stored: either the command ran or the text is in the Inbox."""
    now = datetime.now(UTC)
    return service.capture(session, data.text, local_today(now, timezone), now, interpreter)
