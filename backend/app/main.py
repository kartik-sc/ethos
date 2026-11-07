from fastapi import APIRouter, FastAPI

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.system.router import router as system_router


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
    app.include_router(v1)
    return app


app = create_app()
