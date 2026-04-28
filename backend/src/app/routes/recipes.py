from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, delete, select

from app.database import get_session
from app.models import Recipe, RecipeCategory, RecipeIngredient, RecipeStep, utcnow
from app.schemas import (
    RecipeIngredientRead,
    RecipeRead,
    RecipeStepRead,
    RecipeSummary,
    RecipeWrite,
)
from app.services.pricing import estimated_ingredient_cost

router = APIRouter(prefix="/api/recipes", tags=["recipes"])


def _category_name(session: Session, category_id: str | None) -> str | None:
    if not category_id:
        return None
    category = session.get(RecipeCategory, category_id)
    return category.name if category else None


def _ingredient_reads(
    session: Session, recipe_id: str
) -> tuple[list[RecipeIngredientRead], float | None]:
    rows = session.exec(
        select(RecipeIngredient)
        .where(RecipeIngredient.recipe_id == recipe_id)
        .order_by(RecipeIngredient.position)
    ).all()
    if not rows:
        return [], None

    items: list[RecipeIngredientRead] = []
    known_total = 0.0
    has_unknown = False
    for row in rows:
        cost = estimated_ingredient_cost(session, row)
        if cost is None:
            has_unknown = True
        else:
            known_total += cost
        items.append(
            RecipeIngredientRead(
                id=row.id,
                ingredient_id=row.ingredient_id,
                name=row.name,
                quantity=row.quantity,
                unit=row.unit,
                note=row.note,
                position=row.position,
                estimated_cost=cost,
            )
        )
    return items, None if has_unknown and known_total == 0 else round(known_total, 2)


def _step_reads(session: Session, recipe_id: str) -> list[RecipeStepRead]:
    rows = session.exec(
        select(RecipeStep)
        .where(RecipeStep.recipe_id == recipe_id)
        .order_by(RecipeStep.position)
    ).all()
    return [RecipeStepRead(id=row.id, text=row.text, position=row.position) for row in rows]


def _summary(session: Session, recipe: Recipe) -> RecipeSummary:
    _, cost = _ingredient_reads(session, recipe.id)
    return RecipeSummary(
        id=recipe.id,
        title=recipe.title,
        description=recipe.description,
        category_id=recipe.category_id,
        category_name=_category_name(session, recipe.category_id),
        favorite=recipe.favorite,
        rating=recipe.rating,
        servings=recipe.servings,
        image_ref=recipe.image_ref,
        estimated_cost=cost,
        estimated_cost_per_serving=round(cost / recipe.servings, 2) if cost else None,
        created_at=recipe.created_at,
        updated_at=recipe.updated_at,
    )


def _read(session: Session, recipe: Recipe) -> RecipeRead:
    summary = _summary(session, recipe)
    return RecipeRead(
        **summary.model_dump(),
        user_note=recipe.user_note,
        prep_minutes=recipe.prep_minutes,
        cook_minutes=recipe.cook_minutes,
        ingredients=_ingredient_reads(session, recipe.id)[0],
        steps=_step_reads(session, recipe.id),
    )


def _validate_category(session: Session, category_id: str | None) -> None:
    if category_id and not session.get(RecipeCategory, category_id):
        raise HTTPException(status_code=404, detail="Category not found")


def _replace_children(session: Session, recipe: Recipe, payload: RecipeWrite) -> None:
    session.exec(delete(RecipeIngredient).where(RecipeIngredient.recipe_id == recipe.id))
    session.exec(delete(RecipeStep).where(RecipeStep.recipe_id == recipe.id))
    for index, item in enumerate(payload.ingredients):
        session.add(
            RecipeIngredient(
                recipe_id=recipe.id,
                ingredient_id=item.ingredient_id,
                name=item.name.strip(),
                quantity=item.quantity,
                unit=item.unit,
                note=item.note,
                position=item.position if item.position is not None else index,
            )
        )
    for index, item in enumerate(payload.steps):
        session.add(
            RecipeStep(
                recipe_id=recipe.id,
                text=item.text.strip(),
                position=item.position if item.position is not None else index,
            )
        )


def _apply(recipe: Recipe, payload: RecipeWrite) -> None:
    recipe.title = payload.title.strip()
    recipe.description = payload.description
    recipe.category_id = payload.category_id
    recipe.favorite = payload.favorite
    recipe.rating = payload.rating
    recipe.user_note = payload.user_note
    recipe.servings = payload.servings
    recipe.prep_minutes = payload.prep_minutes
    recipe.cook_minutes = payload.cook_minutes
    recipe.image_ref = payload.image_ref
    recipe.updated_at = utcnow()


@router.get("", response_model=list[RecipeSummary])
def list_recipes(
    q: str | None = Query(default=None),
    favorite: bool | None = Query(default=None),
    category_id: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> list[RecipeSummary]:
    rows = session.exec(select(Recipe).order_by(Recipe.updated_at.desc())).all()
    needle = q.strip().lower() if q else None
    filtered = []
    for recipe in rows:
        if favorite is not None and recipe.favorite != favorite:
            continue
        if category_id and recipe.category_id != category_id:
            continue
        haystack = f"{recipe.title} {recipe.description or ''}".lower()
        if needle and needle not in haystack:
            continue
        filtered.append(_summary(session, recipe))
    return filtered


@router.post("", response_model=RecipeRead)
def create_recipe(
    payload: RecipeWrite, session: Session = Depends(get_session)
) -> RecipeRead:
    _validate_category(session, payload.category_id)
    recipe = Recipe(title=payload.title.strip())
    _apply(recipe, payload)
    session.add(recipe)
    session.commit()
    session.refresh(recipe)
    _replace_children(session, recipe, payload)
    session.commit()
    session.refresh(recipe)
    return _read(session, recipe)


@router.get("/{recipe_id}", response_model=RecipeRead)
def get_recipe(recipe_id: str, session: Session = Depends(get_session)) -> RecipeRead:
    recipe = session.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return _read(session, recipe)


@router.put("/{recipe_id}", response_model=RecipeRead)
def update_recipe(
    recipe_id: str, payload: RecipeWrite, session: Session = Depends(get_session)
) -> RecipeRead:
    _validate_category(session, payload.category_id)
    recipe = session.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    _apply(recipe, payload)
    _replace_children(session, recipe, payload)
    session.add(recipe)
    session.commit()
    session.refresh(recipe)
    return _read(session, recipe)


@router.delete("/{recipe_id}")
def delete_recipe(recipe_id: str, session: Session = Depends(get_session)) -> dict[str, str]:
    recipe = session.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    session.exec(delete(RecipeIngredient).where(RecipeIngredient.recipe_id == recipe.id))
    session.exec(delete(RecipeStep).where(RecipeStep.recipe_id == recipe.id))
    session.delete(recipe)
    session.commit()
    return {"status": "deleted"}
