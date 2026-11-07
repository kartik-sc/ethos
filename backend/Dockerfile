FROM ghcr.io/astral-sh/uv:0.11 AS uv

FROM python:3.13-slim AS build
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

FROM python:3.13-slim
RUN useradd --system --uid 10001 --no-create-home ethos
WORKDIR /app
COPY --from=build /app /app
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1
USER ethos
EXPOSE 8000
CMD ["python", "-m", "app.server"]
