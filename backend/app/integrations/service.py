import hashlib
import secrets
import uuid
from collections.abc import Sequence
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.commands import service as commands
from app.commands.interpreter import Interpreter
from app.inbox import service as inbox
from app.integrations.models import IntegrationToken
from app.integrations.schemas import CaptureResult

TOKEN_PREFIX = "eth_"
CAPTURE_SOURCE = "shortcut"


class TokenNotFoundError(Exception):
    pass


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def list_tokens(session: Session) -> Sequence[IntegrationToken]:
    return session.scalars(
        select(IntegrationToken).order_by(
            IntegrationToken.revoked_at.is_not(None), IntegrationToken.created_at.desc()
        )
    ).all()


def create_token(session: Session, name: str) -> tuple[IntegrationToken, str]:
    """Returns the token row and its secret. The secret is not recoverable afterwards."""
    raw = TOKEN_PREFIX + secrets.token_urlsafe(32)
    token = IntegrationToken(name=name, token_hash=_hash(raw), prefix=raw[:12])
    session.add(token)
    session.commit()
    return token, raw


def revoke_token(session: Session, token_id: uuid.UUID, now: datetime) -> IntegrationToken:
    token = session.get(IntegrationToken, token_id)
    if token is None:
        raise TokenNotFoundError
    if token.revoked_at is None:
        token.revoked_at = now
        session.commit()
    return token


def authenticate(session: Session, raw: str, now: datetime) -> IntegrationToken | None:
    if not raw.startswith(TOKEN_PREFIX):
        return None
    token = session.scalars(
        select(IntegrationToken).where(IntegrationToken.token_hash == _hash(raw))
    ).first()
    if token is None or token.revoked_at is not None:
        return None
    token.last_used_at = now
    session.commit()
    return token


def _to_inbox(session: Session, text: str, reason: str) -> CaptureResult:
    item = inbox.capture(session, text, source=CAPTURE_SOURCE)
    return CaptureResult(status="inbox", message=reason, record_kind="inbox", record_id=item.id)


def capture(
    session: Session, text: str, today: date, now: datetime, interpreter: Interpreter
) -> CaptureResult:
    """Runs clear commands; anything that would need an answer goes to the Inbox instead.

    A Shortcut cannot answer a question or confirm a duplicate, so those captures are kept
    whole for the owner to process rather than guessed at or dropped.
    """
    try:
        result = commands.run(
            session, text, today, now, interpreter, confirm_duplicate=False, source=CAPTURE_SOURCE
        )
    except commands.CommandRejectedError as rejected:
        session.rollback()
        return _to_inbox(session, text, f"Saved to Inbox · {rejected.message}")
    except commands.PossibleDuplicateError:
        session.rollback()
        return _to_inbox(session, text, "Saved to Inbox · looks like something that exists")

    if result.kind == "search":
        return _to_inbox(session, text, "Saved to Inbox")
    if result.kind == "capture":
        return CaptureResult(
            status="inbox",
            message="Saved to Inbox",
            record_kind=result.record_kind,
            record_id=result.record_id,
        )
    return CaptureResult(
        status="executed",
        message=result.message,
        record_kind=result.record_kind,
        record_id=result.record_id,
    )
