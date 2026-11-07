"""Seam for natural-language commands. No provider is chosen yet (spec 4.1 and 13), so the
default interprets nothing and plain text goes to the Inbox. Slash commands never depend on it."""

from datetime import date
from typing import Protocol

from app.commands.parser import Parsed


class Interpreter(Protocol):
    def interpret(self, text: str, today: date) -> Parsed | None:
        """A command for clear text, or None to leave it as an Inbox capture."""
        ...


class NoInterpreter:
    def interpret(self, text: str, today: date) -> Parsed | None:
        return None


def get_interpreter() -> Interpreter:
    return NoInterpreter()
