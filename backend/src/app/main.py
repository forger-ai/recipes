from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.cors import allowed_origins
from app.database_ext import init_app_db
from app.health import router as health_router
from app.routes import categories, ingredients, meal_plan, recipes


def create_app() -> FastAPI:
    app = FastAPI(
        title="Recipes API",
        version="0.1.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def on_startup() -> None:
        init_app_db()

    @app.exception_handler(ValueError)
    async def value_error_handler(_request, exc: ValueError):  # type: ignore[no-untyped-def]
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    app.include_router(health_router, prefix="/api")
    app.include_router(categories.router)
    app.include_router(ingredients.router)
    app.include_router(meal_plan.router)
    app.include_router(recipes.router)
    return app


app = create_app()
