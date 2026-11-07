from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.quotes.schemas import QuoteWrite
from app.quotes.service import create_quote, quote_of_the_day

DAY = date(2026, 11, 7)


def test_rotation_shows_every_quote_once_before_repeating(session: Session) -> None:
    for text in ("one", "two", "three"):
        create_quote(session, QuoteWrite(text=text))

    shown = [quote_of_the_day(session, DAY + timedelta(days=n)) for n in range(4)]

    assert [quote.text for quote in shown if quote] == ["one", "two", "three", "one"]


def test_the_same_day_keeps_the_same_quote(session: Session) -> None:
    create_quote(session, QuoteWrite(text="one"))
    create_quote(session, QuoteWrite(text="two"))
    first = quote_of_the_day(session, DAY)
    again = quote_of_the_day(session, DAY)
    assert first is not None and again is not None and first.id == again.id


def test_a_new_quote_joins_the_cycle_next(session: Session) -> None:
    create_quote(session, QuoteWrite(text="one"))
    quote_of_the_day(session, DAY)
    create_quote(session, QuoteWrite(text="fresh"))
    tomorrow = quote_of_the_day(session, DAY + timedelta(days=1))
    assert tomorrow is not None and tomorrow.text == "fresh"


def test_no_quotes_means_none(session: Session) -> None:
    assert quote_of_the_day(session, DAY) is None


def test_quote_crud(client: TestClient) -> None:
    created = client.post("/api/v1/quotes", json={"text": " Stay hungry. ", "author": ""}).json()
    assert (created["text"], created["author"]) == ("Stay hungry.", None)

    updated = client.put(
        f"/api/v1/quotes/{created['id']}", json={"text": "Stay foolish.", "author": "S. Brand"}
    ).json()
    assert updated["author"] == "S. Brand"
    assert client.get("/api/v1/quotes/today").json()["text"] == "Stay foolish."

    assert client.delete(f"/api/v1/quotes/{created['id']}").status_code == 204
    assert client.get("/api/v1/quotes").json() == []
    assert client.post("/api/v1/quotes", json={"text": "  "}).status_code == 422
