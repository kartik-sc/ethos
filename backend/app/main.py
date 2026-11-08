from fastapi import APIRouter, FastAPI

from app.analytics.router import router as analytics_router
from app.calendar.router import router as calendar_router
from app.commands.router import router as commands_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.dashboard.router import router as dashboard_router
from app.files.router import router as files_router
from app.goals.router import router as goals_router
from app.habits.router import router as habits_router
from app.inbox.router import router as inbox_router
from app.integrations.router import router as integrations_router
from app.notes.router import router as notes_router
from app.preferences.router import router as preferences_router
from app.projects.router import router as projects_router
from app.quotes.router import router as quotes_router
from app.search.router import router as search_router
from app.system.router import router as system_router
from app.tasks.router import router as tasks_router


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging("api", settings.log_level)

    docs_enabled = settings.environment != "production"
    app = FastAPI(
        title="Ethos API",
        version="0.1.0",
        docs_url="/api/docs" if docs_enabled else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if docs_enabled else None,
    )

    v1 = APIRouter(prefix="/api/v1")
    v1.include_router(system_router)
    v1.include_router(tasks_router)
    v1.include_router(projects_router)
    v1.include_router(goals_router)
    v1.include_router(habits_router)
    v1.include_router(inbox_router)
    v1.include_router(preferences_router)
    v1.include_router(quotes_router)
    v1.include_router(dashboard_router)
    v1.include_router(search_router)
    v1.include_router(notes_router)
    v1.include_router(commands_router)
    v1.include_router(analytics_router)
    v1.include_router(files_router)
    v1.include_router(integrations_router)
    v1.include_router(calendar_router)
    app.include_router(v1)
    return app


app = create_app()
