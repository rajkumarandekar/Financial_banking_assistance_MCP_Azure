# Customer Service

Owns the customer directory: profile, contact details, and customer lookup.
This is the source of truth for `customer_id` and `role` (admin/customer) —
other services (account, transaction, ...) reference `customer_id` as an
opaque foreign key without owning identity data themselves.

Run locally:
```
uv sync
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/bankingassistant PROFILE=dev uv run python main.py
```
