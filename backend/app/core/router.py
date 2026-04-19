from fastapi import APIRouter

from app.features.api_key_presets.api import router as api_key_presets_router
from app.features.execution.api import router as execution_router
from app.features.judging.api import router as judging_router
from app.features.models_registry.api import router as model_profiles_router
from app.features.prompts.api import router as prompts_router
from app.features.reports.api import router as reports_router
from app.features.runs.api import router as runs_router
from app.features.sessions.api import router as sessions_router
from app.features.system.api import router as system_router

api_router = APIRouter()
api_router.include_router(system_router)
api_router.include_router(prompts_router)
api_router.include_router(api_key_presets_router)
api_router.include_router(model_profiles_router)
api_router.include_router(sessions_router)
api_router.include_router(runs_router)
api_router.include_router(execution_router)
api_router.include_router(judging_router)
api_router.include_router(reports_router)
