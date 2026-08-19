
import os
import logging
from logging_config import configure_logging
from mcp_tools import mcp
from fastapi import FastAPI
from routers import router as account_routers
from strawberry.fastapi import GraphQLRouter
from gql.schema import schema
from gql.context import get_context
import uvicorn

logger = logging.getLogger(__name__)

def create_app() -> FastAPI:
    # Initialize logging for the app
    configure_logging()
    logger = logging.getLogger(__name__)


   #Add mcp server to the FastAPI app
    mcp_app = mcp.http_app(path='/mcp')
    app = FastAPI(title="Account API and MCP server", lifespan=mcp_app.lifespan)

    # GraphQL API: MCP tools call the same repository layer these resolvers use,
    # so GraphQL is the documented external contract for account-service.
    graphql_router = GraphQLRouter(schema, context_getter=get_context, graphql_ide="graphiql")
    app.include_router(graphql_router, prefix="/graphql", tags=["graphql"])

    # Include the transaction router
    app.include_router(account_routers, prefix="/api", tags=["accounts"])

    # Mount MCP at root ("/", not "/mcp") LAST, and after the routes above -
    # mcp_app already defines its own "/mcp" route internally (fastmcp
    # defaults path to "/mcp" and treats "" as falsy, always reverting to
    # "/mcp"), so mounting under an additional "/mcp" prefix doubles it to a
    # working endpoint at /mcp/mcp instead of /mcp (verified empirically;
    # this was a pre-existing issue in the original main.py, never caught
    # because tests call the MCP tool functions directly in Python rather
    # than over real HTTP). Mounting at root must come last since Starlette
    # matches routes in registration order and a root Mount would otherwise
    # shadow every route declared after it.
    app.mount("/", mcp_app)

    logger.info("FastAPI application created successfully")
    return app

app = create_app()

if __name__ == "__main__":
 
    profile = os.environ.get("PROFILE", "prod")
    port = 8070 if profile == "dev" else 8080
    logger.info(f"Starting account service server with profile: {profile}, port: {port}")
    #run app as uvicorn server
    uvicorn.run("main:app", host="0.0.0.0", port=port)