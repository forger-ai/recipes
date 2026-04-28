from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(UTC)


class RecipeCategory(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    name: str = Field(index=True, unique=True, min_length=1, max_length=80)
    color: str = Field(default="#48624c", max_length=32)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class Ingredient(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    name: str = Field(index=True, unique=True, min_length=1, max_length=120)
    default_unit: str | None = Field(default=None, max_length=32)
    notes: str | None = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class IngredientPriceObservation(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    ingredient_id: str = Field(foreign_key="ingredient.id", index=True)
    price_cents: int = Field(ge=0)
    quantity: float = Field(default=1, gt=0)
    unit: str = Field(default="unit", max_length=32)
    source: str | None = Field(default=None, max_length=160)
    observed_at: datetime = Field(default_factory=utcnow, index=True)
    created_at: datetime = Field(default_factory=utcnow)


class Recipe(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    title: str = Field(index=True, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=1000)
    category_id: str | None = Field(default=None, foreign_key="recipecategory.id")
    favorite: bool = Field(default=False, index=True)
    rating: int | None = Field(default=None, ge=1, le=5)
    user_note: str | None = Field(default=None, max_length=1000)
    servings: int = Field(default=2, ge=1, le=100)
    prep_minutes: int | None = Field(default=None, ge=0)
    cook_minutes: int | None = Field(default=None, ge=0)
    image_ref: str | None = Field(default=None, max_length=1000)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class RecipeIngredient(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    recipe_id: str = Field(foreign_key="recipe.id", index=True)
    ingredient_id: str | None = Field(default=None, foreign_key="ingredient.id")
    name: str = Field(min_length=1, max_length=120)
    quantity: float | None = Field(default=None, gt=0)
    unit: str | None = Field(default=None, max_length=32)
    note: str | None = Field(default=None, max_length=300)
    position: int = Field(default=0, ge=0)


class RecipeStep(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    recipe_id: str = Field(foreign_key="recipe.id", index=True)
    position: int = Field(default=0, ge=0)
    text: str = Field(min_length=1, max_length=1200)


class MealPlanEntry(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    weekday: int = Field(index=True, ge=0, le=6)
    position: int = Field(default=0, ge=0)
    recipe_id: str = Field(foreign_key="recipe.id", index=True)
    note: str | None = Field(default=None, max_length=300)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
