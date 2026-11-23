import os
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import JSON, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

engine = create_engine(os.environ.get("LAB_DATABASE_URL", "sqlite:///./ethicml.sqlite3"),
                       connect_args={"timeout": 30})


class Base(DeclarativeBase):
    pass


class Run(Base):
    __tablename__ = "experiments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    created_at: Mapped[str] = mapped_column(default=lambda: datetime.now(timezone.utc).isoformat())
    result: Mapped[dict] = mapped_column(JSON)
    governance: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    decision: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    def as_dict(self, detail=True):
        result = self.result if detail else {key: self.result[key] for key in ("config", "performance", "fairness")}
        return {"id": self.id, "created_at": self.created_at, **result,
                "governance": self.governance, "decision": self.decision}
