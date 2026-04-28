from __future__ import annotations

import os
from pathlib import Path

TEST_DB = Path("/tmp/recipes-test.sqlite")
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"

from fastapi.testclient import TestClient  # noqa: E402
from sqlmodel import SQLModel  # noqa: E402

from app.database import engine  # noqa: E402
from app.database_ext import init_app_db  # noqa: E402
from app.main import app  # noqa: E402


def reset_db() -> None:
    SQLModel.metadata.drop_all(engine)
    init_app_db()


def test_recipe_crud_with_costs() -> None:
    reset_db()
    client = TestClient(app)

    category = client.post(
        "/api/categories", json={"name": "Cena", "color": "#48624c"}
    ).json()
    ingredient = client.post("/api/ingredients", json={"name": "Tomate"}).json()
    client.post(
        f"/api/ingredients/{ingredient['id']}/prices",
        json={"price": 1200, "quantity": 1, "unit": "kg", "source": "feria"},
    )

    created = client.post(
        "/api/recipes",
        json={
            "title": "Salsa simple",
            "category_id": category["id"],
            "favorite": True,
            "rating": 5,
            "servings": 4,
            "ingredients": [
                {
                    "ingredient_id": ingredient["id"],
                    "name": "Tomate",
                    "quantity": 0.5,
                    "unit": "kg",
                    "position": 0,
                }
            ],
            "steps": [{"text": "Cortar y cocinar.", "position": 0}],
        },
    )

    assert created.status_code == 200
    payload = created.json()
    assert payload["estimated_cost"] == 600
    assert payload["estimated_cost_per_serving"] == 150

    listed = client.get("/api/recipes?favorite=true").json()
    assert listed[0]["title"] == "Salsa simple"

    deleted = client.delete(f"/api/recipes/{payload['id']}")
    assert deleted.status_code == 200


def test_recipe_creates_missing_catalog_ingredient_and_weekly_menu() -> None:
    reset_db()
    client = TestClient(app)

    created = client.post(
        "/api/recipes",
        json={
            "title": "Ensalada",
            "servings": 2,
            "ingredients": [
                {"name": "Lechuga", "quantity": 100, "unit": "g", "position": 0}
            ],
            "steps": [{"text": "Mezclar.", "position": 0}],
        },
    )

    assert created.status_code == 200
    ingredients = client.get("/api/ingredients").json()
    assert ingredients[0]["name"] == "Lechuga"
    assert "default_unit" not in ingredients[0]

    plan = client.put(
        "/api/meal-plan",
        json=[{"weekday": 0, "position": 0, "recipe_id": created.json()["id"]}],
    )
    assert plan.status_code == 200
    assert plan.json()[0]["recipe"]["title"] == "Ensalada"

    deleted = client.delete(f"/api/recipes/{created.json()['id']}")
    assert deleted.status_code == 200
    assert client.get("/api/meal-plan").json() == []


def test_delete_category_and_ingredient_keep_recipe_readable() -> None:
    reset_db()
    client = TestClient(app)

    category = client.post(
        "/api/categories", json={"name": "Almuerzo", "color": "#b75d46"}
    ).json()
    ingredient = client.post("/api/ingredients", json={"name": "Arroz"}).json()
    recipe = client.post(
        "/api/recipes",
        json={
            "title": "Arroz blanco",
            "category_id": category["id"],
            "servings": 2,
            "ingredients": [
                {
                    "ingredient_id": ingredient["id"],
                    "name": "Arroz",
                    "quantity": 200,
                    "unit": "g",
                    "position": 0,
                }
            ],
            "steps": [{"text": "Cocinar.", "position": 0}],
        },
    ).json()

    assert client.delete(f"/api/categories/{category['id']}").status_code == 200
    without_category = client.get(f"/api/recipes/{recipe['id']}").json()
    assert without_category["category_id"] is None
    assert without_category["category_name"] is None

    assert client.delete(f"/api/ingredients/{ingredient['id']}").status_code == 200
    without_ingredient = client.get(f"/api/recipes/{recipe['id']}").json()
    assert without_ingredient["ingredients"][0]["name"] == "Arroz"
    assert without_ingredient["ingredients"][0]["ingredient_id"] is None
