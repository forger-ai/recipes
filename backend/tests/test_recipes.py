from __future__ import annotations

import os
from pathlib import Path

os.environ["DATABASE_URL"] = f"sqlite:///{Path(__file__).parent / 'test.sqlite'}"

from fastapi.testclient import TestClient  # noqa: E402

from app.database_ext import init_app_db  # noqa: E402
from app.main import app  # noqa: E402


def test_recipe_crud_with_costs() -> None:
    db_path = Path(__file__).parent / "test.sqlite"
    if db_path.exists():
        db_path.unlink()
    init_app_db()
    client = TestClient(app)

    category = client.post(
        "/api/categories", json={"name": "Cena", "color": "#48624c"}
    ).json()
    ingredient = client.post(
        "/api/ingredients", json={"name": "Tomate", "default_unit": "kg"}
    ).json()
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
