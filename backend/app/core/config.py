from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "BenchForge API"
    app_version: str = "0.1.0"
    environment: str = Field(default="development", alias="APP_ENV")
    api_prefix: str = "/api"
    debug: bool = Field(default=False, alias="APP_DEBUG")
    log_level: str = Field(default="INFO", alias="BACKEND_LOG_LEVEL")
    database_echo: bool = Field(default=False, alias="DATABASE_ECHO")
    database_url: str = Field(
        default="postgresql+psycopg://benchforge:benchforge@localhost:5432/benchforge",
        alias="DATABASE_URL",
    )
    alembic_database_url: str | None = Field(default=None, alias="ALEMBIC_DATABASE_URL")
    secret_key: str = Field(default="change-me", alias="SECRET_KEY")
    encryption_key: str = Field(
        default="change-me-32-bytes-minimum",
        alias="ENCRYPTION_KEY",
    )
    cors_allowed_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173,http://0.0.0.0:5173",
        alias="CORS_ALLOWED_ORIGINS",
    )

    @property
    def effective_alembic_database_url(self) -> str:
        return self.alembic_database_url or self.database_url

    @property
    def effective_cors_allowed_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_allowed_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
