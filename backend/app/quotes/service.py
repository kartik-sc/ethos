import uuid
from collections.abc import Sequence
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.quotes.models import Quote
from app.quotes.schemas import QuoteWrite


class QuoteNotFoundError(Exception):
    pass


def list_quotes(session: Session) -> Sequence[Quote]:
    return session.scalars(select(Quote).order_by(Quote.created_at)).all()


def get_quote(session: Session, quote_id: uuid.UUID) -> Quote:
    quote = session.get(Quote, quote_id)
    if quote is None:
        raise QuoteNotFoundError
    return quote


def create_quote(session: Session, data: QuoteWrite) -> Quote:
    quote = Quote(text=data.text, author=data.author or None)
    session.add(quote)
    session.commit()
    return quote


def update_quote(session: Session, quote: Quote, data: QuoteWrite) -> Quote:
    quote.text, quote.author = data.text, data.author or None
    session.commit()
    return quote


def delete_quote(session: Session, quote: Quote) -> None:
    session.delete(quote)
    session.commit()


def quote_of_the_day(session: Session, today: date) -> Quote | None:
    """Today's pick stays fixed; otherwise the least recently shown quote takes its turn."""
    shown_today = session.scalars(
        select(Quote).where(Quote.last_shown_on == today).limit(1)
    ).first()
    if shown_today is not None:
        return shown_today
    next_up = session.scalars(
        select(Quote)
        .order_by(Quote.last_shown_on.asc().nulls_first(), Quote.created_at)
        .limit(1)
        .with_for_update()
    ).first()
    if next_up is None:
        return None
    next_up.last_shown_on = today
    session.commit()
    return next_up
