import uuid
from datetime import UTC, datetime
from typing import Annotated, Any
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_session
from app.files import service, storage
from app.files.models import FileAsset
from app.files.schemas import FileConflict, FileRead, FileRename, FileView
from app.projects.service import ProjectNotFoundError, get_project

router = APIRouter(tags=["files"])

SessionDep = Annotated[Session, Depends(get_session)]
NOT_FOUND: dict[int | str, dict[str, Any]] = {404: {"description": "File not found"}}
CONFLICT: dict[int | str, dict[str, Any]] = {
    409: {"model": FileConflict, "description": "A live file in the project has this name"}
}
TOO_LARGE = "Files are limited to 25 MB"


def _load(session: Session, file_id: uuid.UUID, *, trashed: bool = False) -> FileAsset:
    try:
        return service.get_file(session, file_id, trashed=trashed)
    except service.FileAssetNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found") from None


def _ensure_project(session: Session, project_id: uuid.UUID) -> None:
    try:
        get_project(session, project_id)
    except ProjectNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found") from None


def _clean(raw: str) -> str:
    try:
        return service.clean_filename(raw)
    except service.InvalidFilenameError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Invalid filename") from None


def _conflict(existing: FileAsset) -> JSONResponse:
    body = FileConflict(
        detail=f"{existing.filename} already exists in this project",
        existing=FileRead.model_validate(existing),
    )
    return JSONResponse(body.model_dump(mode="json"), status_code=status.HTTP_409_CONFLICT)


@router.get("/projects/{project_id}/files")
def list_files(
    project_id: uuid.UUID, session: SessionDep, view: Annotated[FileView, Query()] = "active"
) -> list[FileRead]:
    _ensure_project(session, project_id)
    files = service.list_files(session, project_id, view)
    return [FileRead.model_validate(asset) for asset in files]


@router.post(
    "/projects/{project_id}/files",
    status_code=status.HTTP_201_CREATED,
    responses={**CONFLICT, 413: {"description": TOO_LARGE}},
    response_model=FileRead,
)
async def upload_file(
    project_id: uuid.UUID,
    request: Request,
    session: SessionDep,
    filename: Annotated[str, Query(max_length=1000)],
    replace: Annotated[bool, Query()] = False,
) -> FileRead | JSONResponse:
    """The request body is the raw file. Set `replace` to overwrite a file with the same name."""
    name = _clean(filename)
    declared = request.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > storage.MAX_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, TOO_LARGE)
    await run_in_threadpool(_ensure_project, session, project_id)
    if not replace:
        try:
            await run_in_threadpool(service.ensure_name_free, session, project_id, name)
        except service.FilenameTakenError as taken:
            return _conflict(taken.existing)

    root = get_settings().file_storage_dir
    try:
        blob = await storage.write_blob(root, request.stream())
    except storage.FileTooLargeError:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, TOO_LARGE) from None

    content_type = (request.headers.get("content-type") or "application/octet-stream")[:200]
    try:
        asset, previous = await run_in_threadpool(
            lambda: service.store(session, project_id, name, content_type, blob, replace=replace)
        )
    except service.FilenameTakenError as taken:
        storage.delete_blob(root, blob.key)
        return _conflict(taken.existing)
    except BaseException:
        storage.delete_blob(root, blob.key)
        raise
    if previous is not None:
        storage.delete_blob(root, previous)
    return FileRead.model_validate(asset)


@router.get("/files/{file_id}/content", responses=NOT_FOUND, response_class=FileResponse)
def download_file(file_id: uuid.UUID, session: SessionDep) -> FileResponse:
    asset = _load(session, file_id)
    path = storage.blob_path(get_settings().file_storage_dir, asset.storage_key)
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File content is missing from storage")
    # Always an attachment: an uploaded HTML file must never render on the app's own origin.
    return FileResponse(
        path,
        media_type=asset.content_type,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(asset.filename)}",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )


@router.patch("/files/{file_id}", responses={**NOT_FOUND, **CONFLICT}, response_model=FileRead)
def rename_file(
    file_id: uuid.UUID, changes: FileRename, session: SessionDep
) -> FileRead | JSONResponse:
    asset = _load(session, file_id)
    try:
        return FileRead.model_validate(service.rename(session, asset, _clean(changes.filename)))
    except service.FilenameTakenError as taken:
        return _conflict(taken.existing)


@router.delete("/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
def trash_file(file_id: uuid.UUID, session: SessionDep) -> None:
    service.trash(session, _load(session, file_id), datetime.now(UTC))


@router.post(
    "/files/{file_id}/restore", responses={**NOT_FOUND, **CONFLICT}, response_model=FileRead
)
def restore_file(file_id: uuid.UUID, session: SessionDep) -> FileRead | JSONResponse:
    asset = _load(session, file_id, trashed=True)
    try:
        return FileRead.model_validate(service.restore(session, asset))
    except service.ProjectTrashedError:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Restore the project to bring back its files"
        ) from None
    except service.FilenameTakenError as taken:
        return _conflict(taken.existing)
