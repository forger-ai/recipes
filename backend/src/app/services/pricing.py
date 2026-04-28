from __future__ import annotations

from sqlmodel import Session, select

from app.models import IngredientPrice, RecipeIngredient


def cents_to_float(cents: int) -> float:
    return round(cents / 100, 2)


def float_to_cents(value: float) -> int:
    return int(round(value * 100))


def latest_price(
    session: Session, ingredient_id: str
) -> IngredientPrice | None:
    statement = (
        select(IngredientPrice)
        .where(IngredientPrice.ingredient_id == ingredient_id)
        .order_by(IngredientPrice.observed_at.desc())
    )
    return session.exec(statement).first()


def estimated_ingredient_cost(
    session: Session, recipe_ingredient: RecipeIngredient
) -> float | None:
    if (
        not recipe_ingredient.ingredient_id
        or not recipe_ingredient.quantity
        or not recipe_ingredient.unit
    ):
        return None

    price = latest_price(session, recipe_ingredient.ingredient_id)
    if not price or price.unit.strip().lower() != recipe_ingredient.unit.strip().lower():
        return None

    return cents_to_float(
        int(round((recipe_ingredient.quantity / price.quantity) * price.price_cents))
    )
