# Recipes

Recipes is a local Forger app for managing a personal cookbook.

It supports recipes with structured ingredients, ordered steps, categories, favorites, ratings, personal notes, image references, and rough cost estimates from observed ingredient prices.

## Stack

- Backend: FastAPI, SQLModel, SQLite, uv.
- Frontend: Vite, React, TypeScript, MUI.
- Shared stack helpers: `commons/`.

## Internal Checks

```bash
cd backend && uv run pytest
cd frontend && npm run verify
```
