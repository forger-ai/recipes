from __future__ import annotations

from app import models as _models  # noqa: F401 - register SQLModel metadata
from app.database import init_db


def init_app_db() -> None:
    init_db()
