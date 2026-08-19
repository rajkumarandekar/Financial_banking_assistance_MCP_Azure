import os
import logging
from logging_config import configure_logging
from mcp_tools import mcp
from fastapi import FastAPI
from strawberry.fastapi import GraphQLRouter
from gql.schema import schema
from gql.context import get_context
import uvicorn

logger = logging.getLogger(__name__)

def create_app() -> FastAPI:
    configure_logging()
    logger = logging.getLogger(__name__)

    mcp_app = mcp.http_app(path='/mcp')
    app = FastAPI(title="Document API and MCP server", lifespan=mcp_app.lifespan)
    graphql_router = GraphQLRouter(schema, context_getter=get_context, graphql_ide="graphiql")
    app.include_router(graphql_router, prefix="/graphql", tags=["graphql"])

    # Mount MCP at root ("/", not "/mcp") LAST - see app/business-api/python/account/main.py
    # for why (double-mounting under "/mcp" breaks the endpoint; mounting at
    # root must come after all other routes or it shadows them).
    app.mount("/", mcp_app)

    logger.info("FastAPI application created successfully")
    return app

app = create_app()

if __name__ == "__main__":
    profile = os.environ.get("PROFILE", "prod")
    port = 8076 if profile == "dev" else 8080
    logger.info(f"Starting document service server with profile: {profile}, port: {port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port)
