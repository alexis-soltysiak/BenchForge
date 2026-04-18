from pydantic import BaseModel


class HealthDependencies(BaseModel):
    database: str


class HealthResponse(BaseModel):
    status: str
    environment: str
    version: str
    dependencies: HealthDependencies

