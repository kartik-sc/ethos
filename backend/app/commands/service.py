import re
from collections.abc import Sequence
from datetime import date, datetime
from decimal import Decimal
from difflib import SequenceMatcher

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.commands.interpreter import Interpreter
from app.commands.parser import Parsed, parse
from app.commands.schemas import (
    CommandPreview,
    CommandResult,
    Duplicate,
    PreviewField,
    RecordKind,
)
from app.goals import service as goals
from app.goals.models import Goal
from app.goals.schemas import GoalCreate
from app.habits import service as habits
from app.habits.models import Habit, Measure
from app.habits.schemas import LogWrite
from app.inbox import service as inbox
from app.notes import service as notes
from app.notes.models import Note
from app.notes.schemas import NoteCreate
from app.projects import service as projects
from app.projects.models import Project
from app.projects.schemas import ProjectCreate
from app.tasks import service as tasks
from app.tasks.models import Task, TaskStatus
from app.tasks.schemas import TaskCreate

ACTIONS = {
    "task": "Create task",
    "deadline": "Create task with deadline",
    "project": "Create project",
    "goal": "Create goal",
    "habit": "Log today",
    "note": "Create note",
    "capture": "Add to Inbox",
    "search": "Search",
}
# Titles at least this similar (0 to 1) are flagged; a shared due date lowers the bar.
SIMILAR = 0.88
SIMILAR_SAME_DAY = 0.75
DUPLICATE_LIMIT = 3


class CommandRejectedError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class PossibleDuplicateError(Exception):
    def __init__(self, duplicates: list[Duplicate]) -> None:
        super().__init__("possible duplicate")
        self.duplicates = duplicates


def normalize(title: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", title.lower()).split())


def slug(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")


def similarity(a: str, b: str) -> float:
    left, right = normalize(a), normalize(b)
    if not left or not right:
        return 0.0
    return 1.0 if left == right else SequenceMatcher(None, left, right).ratio()


def _resolve_project(session: Session, token: str) -> Project:
    live = session.scalars(select(Project).where(Project.deleted_at.is_(None))).all()
    exact = [project for project in live if slug(project.title) == token]
    matches = exact or [project for project in live if slug(project.title).startswith(token)]
    if not matches:
        raise CommandRejectedError(f"No project matches @{token}")
    if len(matches) > 1:
        names = ", ".join(project.title for project in matches[:3])
        raise CommandRejectedError(f"@{token} matches several projects ({names}); be more specific")
    return matches[0]


def _resolve_habit(session: Session, name: str) -> Habit:
    live = session.scalars(select(Habit).where(Habit.deleted_at.is_(None))).all()
    wanted = normalize(name)
    for rule in (
        lambda title: title == wanted,
        lambda title: title.startswith(wanted),
        lambda title: wanted in title,
    ):
        matches = [habit for habit in live if rule(normalize(habit.title))]
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            names = ", ".join(habit.title for habit in matches[:3])
            raise CommandRejectedError(f"“{name}” matches several habits ({names})")
    raise CommandRejectedError(f"No habit called “{name}”")


def _duplicates(session: Session, parsed: Parsed, project: Project | None) -> list[Duplicate]:
    """Similar live records of the same kind. Shown to the owner; never merged."""
    candidates: Sequence[Task | Project | Goal]
    if parsed.kind in ("task", "deadline"):
        candidates = session.scalars(
            select(Task).where(Task.deleted_at.is_(None), Task.status == TaskStatus.OPEN)
        ).all()
    elif parsed.kind == "project":
        candidates = session.scalars(select(Project).where(Project.deleted_at.is_(None))).all()
    elif parsed.kind == "goal":
        candidates = session.scalars(select(Goal).where(Goal.deleted_at.is_(None))).all()
    else:
        return []

    scored = []
    for record in candidates:
        due = record.target_date if isinstance(record, Goal) else record.due_date
        same_context = parsed.due is not None and due == parsed.due
        if isinstance(record, Task) and project is not None:
            same_context = same_context or record.project_id == project.id
        score = similarity(parsed.title, record.title)
        if score >= SIMILAR or (same_context and score >= SIMILAR_SAME_DAY):
            scored.append((score, record, due))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [
        Duplicate(kind=_record_kind(record), id=record.id, title=record.title, due=due)
        for _, record, due in scored[:DUPLICATE_LIMIT]
    ]


def _record_kind(record: Task | Project | Goal) -> RecordKind:
    if isinstance(record, Task):
        return "task"
    return "project" if isinstance(record, Project) else "goal"


def _fields(parsed: Parsed, project: Project | None, habit: Habit | None) -> list[PreviewField]:
    fields: list[PreviewField] = []
    if parsed.kind == "habit" and habit is not None:
        fields.append(PreviewField(label="Habit", value=habit.title))
        if parsed.amount:
            fields.append(
                PreviewField(label="Amount", value=f"{parsed.amount} {habit.unit or ''}".strip())
            )
        if parsed.span:
            fields.append(PreviewField(label="Time", value=f"{parsed.span[0]} to {parsed.span[1]}"))
        return fields
    if parsed.title:
        label = {"search": "Query", "capture": "Text"}.get(parsed.kind, "Title")
        fields.append(PreviewField(label=label, value=parsed.title))
    if parsed.due:
        label = "Target" if parsed.kind == "goal" else "Due"
        fields.append(PreviewField(label=label, value=parsed.due.strftime("%a %d %b %Y")))
    if parsed.priority:
        fields.append(PreviewField(label="Priority", value=parsed.priority))
    if parsed.area:
        fields.append(PreviewField(label="Area", value=parsed.area.value))
    if project is not None:
        fields.append(PreviewField(label="Project", value=project.title))
    if parsed.minutes:
        fields.append(PreviewField(label="Planned", value=f"{parsed.minutes} min"))
    return fields


def _parse(text: str, today: date, interpreter: Interpreter) -> Parsed:
    parsed = parse(text, today)
    if parsed.kind == "capture" and not text.lstrip().startswith("/"):
        return interpreter.interpret(text, today) or parsed
    return parsed


def _habit_question(parsed: Parsed, habit: Habit) -> str | None:
    if habit.measure is Measure.AMOUNT and parsed.amount is None:
        return f"How much? e.g. “/habit {parsed.title} 30” ({habit.unit})"
    if habit.measure is Measure.SPAN and parsed.span is None:
        return f"From when to when? e.g. “/habit {parsed.title} 23:30-07:00”"
    return None


def preview(session: Session, text: str, today: date, interpreter: Interpreter) -> CommandPreview:
    parsed = _parse(text, today, interpreter)
    project: Project | None = None
    habit: Habit | None = None
    error: str | None = None
    question = parsed.question
    try:
        if parsed.project:
            project = _resolve_project(session, parsed.project)
        if parsed.kind == "habit" and parsed.title:
            habit = _resolve_habit(session, parsed.title)
            question = question or _habit_question(parsed, habit)
    except CommandRejectedError as rejected:
        error = rejected.message
    duplicates = _duplicates(session, parsed, project) if parsed.title and not error else []
    return CommandPreview(
        kind=parsed.kind,
        action=ACTIONS[parsed.kind],
        fields=_fields(parsed, project, habit),
        question=question,
        error=error,
        notes=parsed.notes,
        duplicates=duplicates,
        ready=question is None and error is None,
    )


def run(
    session: Session,
    text: str,
    today: date,
    now: datetime,
    interpreter: Interpreter,
    confirm_duplicate: bool,
) -> CommandResult:
    """Executes one command, or raises with what is missing, wrong or possibly duplicated."""
    parsed = _parse(text, today, interpreter)
    if parsed.question:
        raise CommandRejectedError(parsed.question)
    project = _resolve_project(session, parsed.project) if parsed.project else None

    if not confirm_duplicate and (duplicates := _duplicates(session, parsed, project)):
        raise PossibleDuplicateError(duplicates)

    if parsed.kind in ("task", "deadline"):
        task = tasks.create_task(
            session,
            TaskCreate(
                title=parsed.title,
                due_date=parsed.due,
                priority=parsed.priority or "normal",
                area=parsed.area,
                planned_minutes=parsed.minutes,
                project_id=project.id if project else None,
            ),
        )
        due = f" · due {task.due_date:%a %d %b}" if task.due_date else ""
        return CommandResult(
            kind=parsed.kind,
            message=f"Task “{task.title}” created{due}",
            record_kind="task",
            record_id=task.id,
        )
    if parsed.kind == "project":
        created = projects.create_project(
            session, ProjectCreate(title=parsed.title, due_date=parsed.due, area=parsed.area)
        )
        return CommandResult(
            kind="project",
            message=f"Project “{created.title}” created",
            record_kind="project",
            record_id=created.id,
        )
    if parsed.kind == "goal":
        goal = goals.create_goal(
            session, GoalCreate(title=parsed.title, target_date=parsed.due, area=parsed.area)
        )
        return CommandResult(
            kind="goal",
            message=f"Goal “{goal.title}” created",
            record_kind="goal",
            record_id=goal.id,
        )
    if parsed.kind == "note":
        try:
            note: Note = notes.create_note(session, NoteCreate(title=parsed.title), now)
        except notes.NotesError as error:
            raise CommandRejectedError(error.message) from None
        return CommandResult(
            kind="note",
            message=f"Note “{note.title}” created",
            record_kind="note",
            record_id=note.id,
        )
    if parsed.kind == "habit":
        habit = _resolve_habit(session, parsed.title)
        if question := _habit_question(parsed, habit):
            raise CommandRejectedError(question)
        entry = LogWrite.model_validate(
            {
                "amount": Decimal(parsed.amount) if parsed.amount else None,
                "start_time": parsed.span[0] if parsed.span else None,
                "end_time": parsed.span[1] if parsed.span else None,
            }
        )
        try:
            habits.write_log(session, habit, today, entry, today)
        except habits.InvalidLogError as error:
            raise CommandRejectedError(error.message) from None
        logged = f" · {parsed.amount} {habit.unit or ''}".rstrip() if parsed.amount else ""
        return CommandResult(
            kind="habit",
            message=f"Logged “{habit.title}” for today{logged}",
            record_kind="habit",
            record_id=habit.id,
        )
    if parsed.kind == "search":
        return CommandResult(
            kind="search",
            message=f"Searching for “{parsed.title}”",
            record_kind=None,
            record_id=None,
            query=parsed.title,
        )

    item = inbox.capture(session, parsed.title, source="palette")
    return CommandResult(
        kind="capture", message="Added to the Inbox", record_kind="inbox", record_id=item.id
    )
