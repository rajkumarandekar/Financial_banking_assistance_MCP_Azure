# Credit Service

Credit score and credit history. Mostly read-only; credit events are recorded
by admin (or, later, automatically by other services e.g. loan-service on
approval - not wired yet).

Run locally:
```
uv sync
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/bankingassistant PROFILE=dev uv run python main.py
```
