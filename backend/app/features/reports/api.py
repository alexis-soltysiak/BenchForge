from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse, HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.features.reports.schemas import ReportArtifactRead, RunReportRead
from app.features.reports.service import ReportError, ReportsService

router = APIRouter(tags=["reports"])
db_session_dependency = Depends(get_db_session)


def get_reports_service(
    session: AsyncSession = db_session_dependency,
) -> ReportsService:
    return ReportsService(session)


reports_service_dependency = Depends(get_reports_service)


@router.get("/runs/{run_id}/report", response_model=RunReportRead)
async def get_run_report(
    run_id: int,
    service: ReportsService = reports_service_dependency,
) -> RunReportRead:
    try:
        return await service.get_report(run_id)
    except ReportError as exc:
        detail = str(exc)
        status_code = (
            status.HTTP_404_NOT_FOUND
            if "not found" in detail.lower()
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.post("/runs/{run_id}/report/generate", response_model=ReportArtifactRead)
async def generate_run_report(
    run_id: int,
    service: ReportsService = reports_service_dependency,
) -> ReportArtifactRead:
    try:
        return await service.generate_report(run_id)
    except ReportError as exc:
        detail = str(exc)
        status_code = (
            status.HTTP_404_NOT_FOUND
            if "not found" in detail.lower()
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.get("/runs/{run_id}/report/html", response_class=HTMLResponse)
async def get_run_report_html(
    run_id: int,
    service: ReportsService = reports_service_dependency,
) -> HTMLResponse:
    try:
        html, _ = await service.get_report_html(run_id)
        return HTMLResponse(content=html)
    except ReportError as exc:
        detail = str(exc)
        status_code = (
            status.HTTP_404_NOT_FOUND
            if "not found" in detail.lower()
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.get("/runs/{run_id}/report/pdf")
async def get_run_report_pdf(
    run_id: int,
    service: ReportsService = reports_service_dependency,
) -> FileResponse:
    try:
        pdf_path = await service.get_report_pdf(run_id)
        return FileResponse(
            path=pdf_path,
            media_type="application/pdf",
        )
    except ReportError as exc:
        detail = str(exc)
        status_code = (
            status.HTTP_404_NOT_FOUND
            if "not found" in detail.lower()
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=detail) from exc
