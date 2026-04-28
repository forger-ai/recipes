from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, delete, select

from app.database import get_session
from app.models import MealPlanEntry, Recipe, utcnow
from app.routes.recipes import _summary
from app.schemas import MealPlanEntryRead, MealPlanEntryWrite

router = APIRouter(prefix="/api/meal-plan", tags=["meal-plan"])


def _read_entry(session: Session, entry: MealPlanEntry) -> MealPlanEntryRead:
    recipe = session.get(Recipe, entry.recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return MealPlanEntryRead(
        id=entry.id,
        weekday=entry.weekday,
        position=entry.position,
        recipe_id=entry.recipe_id,
        note=entry.note,
        recipe=_summary(session, recipe),
    )


@router.get("", response_model=list[MealPlanEntryRead])
def list_meal_plan(session: Session = Depends(get_session)) -> list[MealPlanEntryRead]:
    rows = session.exec(
        select(MealPlanEntry).order_by(MealPlanEntry.weekday, MealPlanEntry.position)
    ).all()
    return [_read_entry(session, entry) for entry in rows]


@router.put("", response_model=list[MealPlanEntryRead])
def replace_meal_plan(
    payload: list[MealPlanEntryWrite], session: Session = Depends(get_session)
) -> list[MealPlanEntryRead]:
    session.exec(delete(MealPlanEntry))
    entries: list[MealPlanEntry] = []
    for item in payload:
        recipe = session.get(Recipe, item.recipe_id)
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        entry = MealPlanEntry(
            weekday=item.weekday,
            position=item.position,
            recipe_id=item.recipe_id,
            note=item.note,
            updated_at=utcnow(),
        )
        session.add(entry)
        entries.append(entry)
    session.commit()
    for entry in entries:
        session.refresh(entry)
    return [_read_entry(session, entry) for entry in entries]
