# Recipes

Recipes is a local Forger app for managing a personal cookbook.

It supports recipes with structured ingredients, ordered steps, categories, favorites, ratings, personal notes, image references, rough cost estimates from separate ingredient price records, ingredient catalog management, deletion controls, and a weekly menu with drag and drop ordering across days.

## Stack

- Backend: FastAPI, SQLModel, SQLite, uv.
- Frontend: Vite, React, TypeScript, MUI.
- Shared stack helpers: `commons/`.

## Internal Checks

```bash
cd backend && uv run pytest
cd frontend && npm run verify
```
