from __future__ import annotations

from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.database import engine
from app.database_ext import init_app_db
from app.mcp_runtime import ToolError, ToolRegistry, main
from app.models import Ingredient, MealPlanEntry, Recipe, utcnow
from app.routes.ingredients import _ingredient_read
from app.routes.meal_plan import _read_entry
from app.routes.recipes import _summary
from app.schemas import IngredientBase, MealPlanEntryWrite, RecipeWrite

registry = ToolRegistry()


def _dump(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    return value


def _require_string(args: dict[str, Any], name: str) -> str:
    value = args.get(name)
    if not isinstance(value, str) or not value.strip():
        raise ToolError(f"{name} is required", code="invalid_input")
    return value.strip()


@registry.tool(
    "list_recipes",
    "List Recipes recipes with optional search, favorite, category, and limit filters.",
    {
        "type": "object",
        "properties": {
            "q": {"type": "string"},
            "favorite": {"type": "boolean"},
            "category_id": {"type": "string"},
            "limit": {"type": "number", "minimum": 1, "maximum": 500},
        },
        "additionalProperties": False,
    },
)
def list_recipes(args: dict[str, Any]) -> dict[str, Any]:
    init_app_db()
    needle = args.get("q").strip().lower() if isinstance(args.get("q"), str) else None
    favorite = args.get("favorite") if isinstance(args.get("favorite"), bool) else None
    category_id = (
        args.get("category_id").strip()
        if isinstance(args.get("category_id"), str)
        else None
    )
    limit = args.get("limit")
    resolved_limit = int(limit) if isinstance(limit, int | float) else 100
    resolved_limit = max(1, min(resolved_limit, 500))
    with Session(engine) as session:
        rows = session.exec(select(Recipe).order_by(Recipe.updated_at.desc())).all()
        recipes = []
        for recipe in rows:
            if favorite is not None and recipe.favorite != favorite:
                continue
            if category_id and recipe.category_id != category_id:
                continue
            haystack = f"{recipe.title} {recipe.description or ''}".lower()
            if needle and needle not in haystack:
                continue
            recipes.append(_dump(_summary(session, recipe)))
            if len(recipes) >= resolved_limit:
                break
        return {"success": True, "recipes": recipes, "limit": resolved_limit}


@registry.tool(
    "create_recipe",
    "Create one Recipes recipe with structured ingredients and steps.",
    {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "description": {"type": ["string", "null"]},
            "category_id": {"type": ["string", "null"]},
            "favorite": {"type": "boolean"},
            "rating": {"type": ["number", "null"]},
            "user_note": {"type": ["string", "null"]},
            "servings": {"type": "number"},
            "prep_minutes": {"type": ["number", "null"]},
            "cook_minutes": {"type": ["number", "null"]},
            "image_ref": {"type": ["string", "null"]},
            "ingredients": {"type": "array"},
            "steps": {"type": "array"},
        },
        "required": ["title"],
        "additionalProperties": False,
    },
)
def create_recipe(args: dict[str, Any]) -> dict[str, Any]:
    init_app_db()
    payload = RecipeWrite(**args)
    with Session(engine) as session:
        from app.routes.recipes import create_recipe as create_recipe_route

        recipe = create_recipe_route(payload, session)
        return {"success": True, "recipe": _dump(recipe)}


@registry.tool(
    "list_ingredients",
    "List Recipes ingredient catalog entries.",
)
def list_ingredients(_args: dict[str, Any]) -> dict[str, Any]:
    init_app_db()
    with Session(engine) as session:
        ingredients = session.exec(select(Ingredient).order_by(Ingredient.name)).all()
        return {
            "success": True,
            "ingredients": [_dump(_ingredient_read(ingredient)) for ingredient in ingredients],
        }


@registry.tool(
    "create_ingredient",
    "Create one Recipes ingredient catalog entry.",
    {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "notes": {"type": ["string", "null"]},
        },
        "required": ["name"],
        "additionalProperties": False,
    },
)
def create_ingredient(args: dict[str, Any]) -> dict[str, Any]:
    init_app_db()
    payload = IngredientBase(**args)
    with Session(engine) as session:
        ingredient = Ingredient(name=payload.name.strip(), notes=payload.notes)
        session.add(ingredient)
        try:
            session.commit()
        except IntegrityError as exc:
            session.rollback()
            raise ToolError("Ingredient already exists", code="conflict") from exc
        session.refresh(ingredient)
        return {"success": True, "ingredient": _dump(_ingredient_read(ingredient))}


@registry.tool(
    "list_weekly_plan",
    "List current Recipes weekly meal planning entries.",
)
def list_weekly_plan(_args: dict[str, Any]) -> dict[str, Any]:
    init_app_db()
    with Session(engine) as session:
        rows = session.exec(
            select(MealPlanEntry).order_by(MealPlanEntry.weekday, MealPlanEntry.position)
        ).all()
        return {"success": True, "entries": [_dump(_read_entry(session, entry)) for entry in rows]}


@registry.tool(
    "create_weekly_plan_entry",
    "Create one Recipes weekly meal planning entry.",
    {
        "type": "object",
        "properties": {
            "weekday": {"type": "number", "minimum": 0, "maximum": 6},
            "position": {"type": "number", "minimum": 0},
            "recipe_id": {"type": "string"},
            "note": {"type": ["string", "null"]},
        },
        "required": ["weekday", "recipe_id"],
        "additionalProperties": False,
    },
)
def create_weekly_plan_entry(args: dict[str, Any]) -> dict[str, Any]:
    init_app_db()
    payload = MealPlanEntryWrite(**args)
    with Session(engine) as session:
        recipe = session.get(Recipe, payload.recipe_id)
        if not recipe:
            raise ToolError("Recipe not found", code="not_found")
        entry = MealPlanEntry(
            weekday=payload.weekday,
            position=payload.position,
            recipe_id=payload.recipe_id,
            note=payload.note,
            updated_at=utcnow(),
        )
        session.add(entry)
        session.commit()
        session.refresh(entry)
        return {"success": True, "entry": _dump(_read_entry(session, entry))}


@registry.tool(
    "edit_weekly_plan_entry",
    "Edit one Recipes weekly meal planning entry.",
    {
        "type": "object",
        "properties": {
            "entry_id": {"type": "string"},
            "weekday": {"type": "number", "minimum": 0, "maximum": 6},
            "position": {"type": "number", "minimum": 0},
            "recipe_id": {"type": "string"},
            "note": {"type": ["string", "null"]},
        },
        "required": ["entry_id"],
        "additionalProperties": False,
    },
)
def edit_weekly_plan_entry(args: dict[str, Any]) -> dict[str, Any]:
    init_app_db()
    entry_id = _require_string(args, "entry_id")
    with Session(engine) as session:
        entry = session.get(MealPlanEntry, entry_id)
        if not entry:
            raise ToolError("Meal plan entry not found", code="not_found")
        if "recipe_id" in args:
            recipe_id = _require_string(args, "recipe_id")
            if not session.get(Recipe, recipe_id):
                raise ToolError("Recipe not found", code="not_found")
            entry.recipe_id = recipe_id
        if "weekday" in args:
            payload_weekday = MealPlanEntryWrite(
                weekday=args["weekday"],
                position=entry.position,
                recipe_id=entry.recipe_id,
                note=entry.note,
            )
            entry.weekday = payload_weekday.weekday
        if "position" in args:
            payload_position = MealPlanEntryWrite(
                weekday=entry.weekday,
                position=args["position"],
                recipe_id=entry.recipe_id,
                note=entry.note,
            )
            entry.position = payload_position.position
        if "note" in args:
            entry.note = args["note"] if isinstance(args["note"], str) else None
        entry.updated_at = utcnow()
        session.add(entry)
        session.commit()
        session.refresh(entry)
        return {"success": True, "entry": _dump(_read_entry(session, entry))}


@registry.tool(
    "delete_weekly_plan_entry",
    "Delete one Recipes weekly meal planning entry.",
    {
        "type": "object",
        "properties": {"entry_id": {"type": "string"}},
        "required": ["entry_id"],
        "additionalProperties": False,
    },
)
def delete_weekly_plan_entry(args: dict[str, Any]) -> dict[str, Any]:
    init_app_db()
    entry_id = _require_string(args, "entry_id")
    with Session(engine) as session:
        entry = session.get(MealPlanEntry, entry_id)
        if not entry:
            raise ToolError("Meal plan entry not found", code="not_found")
        session.delete(entry)
        session.commit()
        return {"success": True, "deletedEntryId": entry_id}


if __name__ == "__main__":
    main(registry, server_name="recipes")
