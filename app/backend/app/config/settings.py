import os
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def get_env_files() -> List[str]:
    """Get list of environment files to load based on current environment."""
    env = os.getenv("PROFILE")

    if env:
        print(f"Loading environment files for environment: {env}")
    else:
        print("No environment specified, environment variables only configuration will be used.")
        return []
    
    env = env.lower()
    # List of env files to try (in order of priority - later files override earlier ones)
    env_files = [
        ".env",  # Base environment file
        f".env.{env}"  # Environment-specific file
        
    ]

    final_env_files = []
    # print found env files only if path exists
    print("Environment files loading:")    
    for f in env_files:
        print(f"Loading: {f}")
        if os.path.exists(f):
            final_env_files.append(f)
            print(f"{f} Loaded")

    return final_env_files

class Settings(BaseSettings):
    """Application settings loaded from environment or environment-specific .env files.

    Settings are loaded in the following order (later sources override earlier ones):
    1. Default values defined in the class
    2. Environment variables
    3. Base .env file
    4. Environment-specific .env file (e.g., .env.development, .env.production)
    
    The environment is determined by the ENVIRONMENT environment variable or defaults to 'development'.
    """

    # app-level
    APP_NAME: str = "Home Banking Multi-Agent Assistant"
    PROFILE: str = Field(default="prod")
    AGENTS_TYPE: str = Field(default="foundry_v2")  # options: azure_chat, foundry_v2

    #Logging and monitoring
    APPLICATIONINSIGHTS_CONNECTION_STRING: str | None = Field(default=None)
    ENABLE_OTEL : bool = Field(default=True)
  
    
    # maps to environment variables described by the user

    AZURE_DOCUMENT_INTELLIGENCE_SERVICE: str | None = Field(default=None)
    
    # Azure AI Foundry v1 configuration
    FOUNDRY_PROJECT_ENDPOINT: str | None = Field(default=None)
    FOUNDRY_MODEL_DEPLOYMENT_NAME: str = Field(default="gpt-4o")
    
    # Azure AI Foundry v2 configuration
    AZURE_AI_PROJECT_ENDPOINT: str | None = Field(default=None)
    AZURE_AI_MODEL_DEPLOYMENT_NAME: str = Field(default="gpt-4.1")

    #Azure OpenAI Chat configuration
    AZURE_OPENAI_ENDPOINT: str | None = Field(default=None)
    AZURE_OPENAI_CHAT_DEPLOYMENT_NAME: str = Field(default="gpt-4o")

    # Azure services
    AZURE_STORAGE_ACCOUNT: str | None = Field(default=None)
    AZURE_STORAGE_CONTAINER: str | None = Field(default="content")

    # Azure Cosmos DB for NoSQL (ChatKit metadata store)
    AZURE_COSMOSDB_ENDPOINT: str | None = Field(default=None, description="Cosmos DB account endpoint (e.g. https://<account>.documents.azure.com:443/)")
    AZURE_COSMOSDB_DATABASE: str = Field(default="chatkit", description="Cosmos DB database name")

    #MCP servers
    ACCOUNT_MCP_URL: str | None= Field(default=None,description="MCP server URL (required)", min_length=1)
    TRANSACTION_MCP_URL: str | None= Field(default=None,description="MCP server URL (required)", min_length=1)
    PAYMENT_MCP_URL: str | None= Field(default=None,description="MCP server URL (required)", min_length=1)
    LOAN_MCP_URL: str | None = Field(default=None, description="Loan service MCP server URL")
    CREDIT_MCP_URL: str | None = Field(default=None, description="Credit service MCP server URL")
    DOCUMENT_MCP_URL: str | None = Field(default=None, description="Document service MCP server URL")
    COMMUNICATION_MCP_URL: str | None = Field(default=None, description="Communication service MCP server URL")
    INVESTMENT_MCP_URL: str | None = Field(default=None, description="Investment service MCP server URL")

    # customer-service is queried over GraphQL (not MCP) for identity resolution -
    # see app/backend/app/helpers/customer_service_client.py. When unset, auth.py
    # falls back to the static demo_customer_map.py shim.
    CUSTOMER_SERVICE_URL: str | None = Field(default=None, description="Customer service base URL, e.g. http://customer:8080")
    # Separate from CUSTOMER_SERVICE_URL above - this is the MCP endpoint the
    # CustomerAgent calls for profile lookup/search (customer-service exposes
    # both a GraphQL API and an MCP server, same as every other service).
    CUSTOMER_MCP_URL: str | None = Field(default=None, description="Customer service MCP server URL")

    # Support for User Assigned Managed Identity: empty means system-managed
    AZURE_CLIENT_ID: str  | None = Field(default="system-managed-identity")

    # End-user authentication (Entra ID / Azure AD) - distinct from AZURE_CLIENT_ID above,
    # which is the backend's own managed-identity credential for calling Azure resources.
    # Defaults to disabled so the app keeps working end-to-end (with the mock user profile)
    # until a real Entra ID app registration is provisioned (see docs/entra-app-registration-setup.md).
    AUTH_ENABLED: bool = Field(default=False)
    AZURE_TENANT_ID: str | None = Field(default=None, description="Entra ID tenant id for token validation")
    AZURE_AD_BACKEND_CLIENT_ID: str | None = Field(default=None, description="Expected 'aud' claim: backend's app registration client id")
    AZURE_AD_ISSUER: str | None = Field(default=None, description="Override the expected 'iss' claim; defaults to the v2.0 issuer for AZURE_TENANT_ID")

    model_config = SettingsConfigDict(
        env_file=get_env_files(),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()