from sqlalchemy import Boolean, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models import Base, TimestampMixin


class ModelProfile(Base, TimestampMixin):
    __tablename__ = "model_profile"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(240), unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    provider_type: Mapped[str] = mapped_column(String(64), nullable=False)
    api_style: Mapped[str] = mapped_column(String(64), nullable=False)
    runtime_type: Mapped[str] = mapped_column(String(32), nullable=False)
    machine_label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    endpoint_url: Mapped[str] = mapped_column(String(500), nullable=False)
    model_identifier: Mapped[str] = mapped_column(String(255), nullable=False)
    secret_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    api_key_preset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    timeout_seconds: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=60,
        server_default="60",
    )
    context_window: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pricing_input_per_million: Mapped[float | None] = mapped_column(
        Numeric(12, 4),
        nullable=True,
    )
    pricing_output_per_million: Mapped[float | None] = mapped_column(
        Numeric(12, 4),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    local_load_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    is_archived: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
