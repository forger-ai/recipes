from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.database import get_session
from app.models import Ingredient, IngredientPriceObservation, utcnow
from app.schemas import (
    IngredientBase,
    IngredientRead,
    PriceObservationCreate,
    PriceObservationRead,
)
from app.services.pricing import cents_to_float, float_to_cents, latest_price

router = APIRouter(prefix="/api/ingredients", tags=["ingredients"])


def _price_read(price: IngredientPriceObservation) -> PriceObservationRead:
    return PriceObservationRead(
        id=price.id,
        ingredient_id=price.ingredient_id,
        price=cents_to_float(price.price_cents),
        quantity=price.quantity,
        unit=price.unit,
        source=price.source,
        observed_at=price.observed_at,
    )


def _ingredient_read(session: Session, ingredient: Ingredient) -> IngredientRead:
    price = latest_price(session, ingredient.id)
    return IngredientRead(
        id=ingredient.id,
        name=ingredient.name,
        default_unit=ingredient.default_unit,
        notes=ingredient.notes,
        latest_price=_price_read(price) if price else None,
    )


@router.get("", response_model=list[IngredientRead])
def list_ingredients(session: Session = Depends(get_session)) -> list[IngredientRead]:
    ingredients = session.exec(select(Ingredient).order_by(Ingredient.name)).all()
    return [_ingredient_read(session, ingredient) for ingredient in ingredients]


@router.post("", response_model=IngredientRead)
def create_ingredient(
    payload: IngredientBase, session: Session = Depends(get_session)
) -> IngredientRead:
    ingredient = Ingredient(
        name=payload.name.strip(),
        default_unit=payload.default_unit,
        notes=payload.notes,
    )
    session.add(ingredient)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail="Ingredient already exists") from exc
    session.refresh(ingredient)
    return _ingredient_read(session, ingredient)


@router.put("/{ingredient_id}", response_model=IngredientRead)
def update_ingredient(
    ingredient_id: str, payload: IngredientBase, session: Session = Depends(get_session)
) -> IngredientRead:
    ingredient = session.get(Ingredient, ingredient_id)
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    ingredient.name = payload.name.strip()
    ingredient.default_unit = payload.default_unit
    ingredient.notes = payload.notes
    ingredient.updated_at = utcnow()
    session.add(ingredient)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail="Ingredient already exists") from exc
    session.refresh(ingredient)
    return _ingredient_read(session, ingredient)


@router.post("/{ingredient_id}/prices", response_model=PriceObservationRead)
def add_price(
    ingredient_id: str,
    payload: PriceObservationCreate,
    session: Session = Depends(get_session),
) -> PriceObservationRead:
    ingredient = session.get(Ingredient, ingredient_id)
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    price = IngredientPriceObservation(
        ingredient_id=ingredient_id,
        price_cents=float_to_cents(payload.price),
        quantity=payload.quantity,
        unit=payload.unit,
        source=payload.source,
        observed_at=payload.observed_at or utcnow(),
    )
    session.add(price)
    session.commit()
    session.refresh(price)
    return _price_read(price)
