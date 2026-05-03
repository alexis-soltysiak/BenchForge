from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy.exc import DBAPIError

from app.features.system.schemas import HealthDependencies, HealthResponse
from app.main import create_app


def test_root_endpoint() -> None:
    client = TestClient(create_app())

    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["name"] == "BenchForge API"


def test_health_endpoint() -> None:
    async def fake_health_response(_: object) -> HealthResponse:
        return HealthResponse(
            status="ok",
            environment="test",
            version="0.1.0",
            dependencies=HealthDependencies(database="ok"),
        )

    with patch(
        "app.features.system.api.build_health_response",
        new=fake_health_response,
    ):
        client = TestClient(create_app())

        response = client.get("/api/health")

        assert response.status_code == 200
        assert response.json() == {
            "status": "ok",
            "environment": "test",
            "version": "0.1.0",
            "dependencies": {"database": "ok"},
        }


def test_cors_preflight_allows_local_frontend() -> None:
    client = TestClient(create_app())

    response = client.options(
        "/api/prompts",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_database_errors_return_service_unavailable() -> None:
    app = create_app()

    @app.get("/api/test-db-error")
    async def test_db_error() -> None:
        raise DBAPIError("SELECT 1", {}, Exception("db offline"))

    client = TestClient(app)

    response = client.get("/api/test-db-error")

    assert response.status_code == 503
    body = response.json()
    assert body["detail"] == "Database unavailable. The API cannot connect to the database."
    assert body["error_type"] == "DBAPIError"
