from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

RecipeUnit = Literal[
    "unit",
    "ml",
    "l",
    "litro",
    "g",
    "mg",
    "kg",
    "cucharada",
    "cucharadita",
    "cuchara",
    "taza",
    "pizca",
    "onza",
    "lb",
    "paquete",
    "lata",
    "botella",
]


class CategoryBase(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    color: str = Field(default="#48624c", max_length=32)


class CategoryRead(CategoryBase):
    id: str


class IngredientBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    default_unit: RecipeUnit | None = None
    notes: str | None = Field(default=None, max_length=500)


class PriceObservationRead(BaseModel):
    id: str
    ingredient_id: str
    price: float
    quantity: float
    unit: str
    source: str | None
    observed_at: datetime


class IngredientRead(IngredientBase):
    id: str
    latest_price: PriceObservationRead | None = None


class PriceObservationCreate(BaseModel):
    price: float = Field(ge=0)
    quantity: float = Field(default=1, gt=0)
    unit: RecipeUnit = "unit"
    source: str | None = Field(default=None, max_length=160)
    observed_at: datetime | None = None


class RecipeIngredientWrite(BaseModel):
    ingredient_id: str | None = None
    name: str = Field(min_length=1, max_length=120)
    quantity: float | None = Field(default=None, gt=0)
    unit: RecipeUnit | None = None
    note: str | None = Field(default=None, max_length=300)
    position: int = Field(default=0, ge=0)


class RecipeIngredientRead(RecipeIngredientWrite):
    id: str
    estimated_cost: float | None = None


class RecipeStepWrite(BaseModel):
    text: str = Field(min_length=1, max_length=1200)
    position: int = Field(default=0, ge=0)


class RecipeStepRead(RecipeStepWrite):
    id: str


class RecipeWrite(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=1000)
    category_id: str | None = None
    favorite: bool = False
    rating: int | None = Field(default=None, ge=1, le=5)
    user_note: str | None = Field(default=None, max_length=1000)
    servings: int = Field(default=2, ge=1, le=100)
    prep_minutes: int | None = Field(default=None, ge=0)
    cook_minutes: int | None = Field(default=None, ge=0)
    image_ref: str | None = Field(default=None, max_length=1000)
    ingredients: list[RecipeIngredientWrite] = Field(default_factory=list)
    steps: list[RecipeStepWrite] = Field(default_factory=list)


class RecipeSummary(BaseModel):
    id: str
    title: str
    description: str | None
    category_id: str | None
    category_name: str | None
    favorite: bool
    rating: int | None
    servings: int
    image_ref: str | None
    estimated_cost: float | None
    estimated_cost_per_serving: float | None
    created_at: datetime
    updated_at: datetime


class RecipeRead(RecipeSummary):
    user_note: str | None
    prep_minutes: int | None
    cook_minutes: int | None
    ingredients: list[RecipeIngredientRead]
    steps: list[RecipeStepRead]


class MealPlanEntryWrite(BaseModel):
    weekday: int = Field(ge=0, le=6)
    position: int = Field(default=0, ge=0)
    recipe_id: str
    note: str | None = Field(default=None, max_length=300)


class MealPlanEntryRead(MealPlanEntryWrite):
    id: str
    recipe: RecipeSummary
