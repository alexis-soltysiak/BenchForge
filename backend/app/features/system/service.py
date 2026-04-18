from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.database import check_database_connection
from app.features.system.schemas import HealthDependencies, HealthResponse


async def build_health_response(
    session: AsyncSession,
    settings: Settings | None = None,
) -> HealthResponse:
    app_settings = settings or get_settings()
    database_status = "ok"

    try:
        await check_database_connection(session)
    except Exception:
        database_status = "error"

    status = "ok" if database_status == "ok" else "degraded"
    return HealthResponse(
        status=status,
        environment=app_settings.environment,
        version=app_settings.app_version,
        dependencies=HealthDependencies(database=database_status),
    )

