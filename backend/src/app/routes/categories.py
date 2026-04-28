from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.database import get_session
from app.models import RecipeCategory, utcnow
from app.schemas import CategoryBase, CategoryRead

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=list[CategoryRead])
def list_categories(session: Session = Depends(get_session)) -> list[RecipeCategory]:
    return list(session.exec(select(RecipeCategory).order_by(RecipeCategory.name)).all())


@router.post("", response_model=CategoryRead)
def create_category(
    payload: CategoryBase, session: Session = Depends(get_session)
) -> RecipeCategory:
    category = RecipeCategory(name=payload.name.strip(), color=payload.color)
    session.add(category)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail="Category already exists") from exc
    session.refresh(category)
    return category


@router.put("/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: str, payload: CategoryBase, session: Session = Depends(get_session)
) -> RecipeCategory:
    category = session.get(RecipeCategory, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    category.name = payload.name.strip()
    category.color = payload.color
    category.updated_at = utcnow()
    session.add(category)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail="Category already exists") from exc
    session.refresh(category)
    return category
