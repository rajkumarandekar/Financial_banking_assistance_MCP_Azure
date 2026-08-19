# Document Service

Generates and stores account statements, payment receipts, and loan
approval/rejection letters. Pulls source data from account-service,
transaction-service, payment-service, and loan-service over GraphQL rather
than owning that data itself - this service's own table only stores the
generated document (metadata + rendered text content).

For this POC, "generated" documents are plain formatted text, not real PDFs -
no PDF rendering library is wired in yet.

Run locally:
```
uv sync
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/bankingassistant PROFILE=dev uv run python main.py
```
