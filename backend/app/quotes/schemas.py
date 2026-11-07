import uuid
from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

QuoteText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]
Author = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]


class QuoteWrite(BaseModel):
    text: QuoteText
    author: Author | None = None


class QuoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    text: str
    author: str | None
    created_at: datetime
    last_shown_on: date | None
