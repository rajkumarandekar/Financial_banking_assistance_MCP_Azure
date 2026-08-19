# Investment Service

Real holdings/trades for the Investments feature, plus stock prices refreshed
from Alpha Vantage's official **remote** MCP server
(`https://mcp.alphavantage.co/mcp`) - a real third-party MCP server this
service calls as a client, not one we host ourselves.

Same pattern as the other 8 business microservices: Postgres
(`investment_schema`) + Strawberry GraphQL (`/graphql`) + MCP tools (`/mcp`).

## Required env vars (`.env.dev`)

```
DATABASE_URL=postgresql+asyncpg://...        # same Postgres server, investment_schema
PROFILE=dev
ALPHA_VANTAGE_API_KEY=<your free key>         # https://www.alphavantage.co/support/#api-key
```

## Price refresh

Alpha Vantage's free tier is rate-limited to 25 requests/day, so prices are
NOT fetched live per-request. `price_refresh.py` refreshes every tracked
symbol's `GLOBAL_QUOTE` on a timer (every few hours, well inside the daily
budget for ~8 tracked symbols) and caches the result in `stock_prices`.
Holdings always read from that cache, never call Alpha Vantage directly.

A manual "Refresh Prices" mutation/REST call is also exposed for on-demand
refresh, still going through the same cache.

Run manually for local dev: `uv run python -m db.seed`
