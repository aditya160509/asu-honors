"""User-owned research-workspace artifacts."""

from datetime import date
from typing import Optional

from sqlalchemy import Date, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from db.models.base import Base, TimestampMixin

try:
    from sqlalchemy.dialects.postgresql import JSONB as JSONType
except ImportError:  # pragma: no cover
    from sqlalchemy import JSON as JSONType


class ResearchNotebook(Base, TimestampMixin):
    __tablename__ = "research_notebooks"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(800))
    query_json: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)
    visibility: Mapped[str] = mapped_column(String(20), nullable=False, default="private")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    __table_args__ = (
        UniqueConstraint("user_id", "title", name="uq_research_notebooks_user_title"),
        Index("ix_research_notebooks_user_updated", "user_id", "updated_at"),
    )


class ResearchNotebookBlock(Base, TimestampMixin):
    __tablename__ = "research_notebook_blocks"

    id: Mapped[int] = mapped_column(primary_key=True)
    notebook_id: Mapped[int] = mapped_column(ForeignKey("research_notebooks.id", ondelete="CASCADE"), nullable=False)
    block_type: Mapped[str] = mapped_column(String(30), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    payload_json: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)
    provenance_json: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)

    __table_args__ = (Index("ix_research_notebook_blocks_order", "notebook_id", "position"),)


class ChartAnnotation(Base, TimestampMixin):
    __tablename__ = "chart_annotations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ticker: Mapped[str] = mapped_column(String(16), nullable=False)
    timeline_id: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    timeframe: Mapped[str] = mapped_column(String(20), nullable=False, default="1D")
    tool: Mapped[str] = mapped_column(String(30), nullable=False)
    anchors_json: Mapped[list] = mapped_column(JSONType, nullable=False, default=list)
    style_json: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)
    evidence_json: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    __table_args__ = (
        Index("ix_chart_annotations_user_symbol", "user_id", "ticker", "timeline_id"),
    )
