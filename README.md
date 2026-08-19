# SecureBank AI — Multi-Agent Banking Assistant

A full-stack, AI-powered personal banking assistant. Users chat naturally to check balances, review transactions, pay bills (including by uploading an invoice image), apply for loans, manage cards, and more — all handled by a team of specialist AI agents working behind a single conversational interface.

Built on **Microsoft Agent Framework**, **Azure OpenAI / Azure AI Foundry**, and a domain-driven microservices backend, with a React/TypeScript frontend.

<div align="center">

[**Architecture**](#architecture) · [**Features**](#features) · [**Tech Stack**](#tech-stack) · [**Getting Started**](#getting-started) · [**Deployment**](#deployment)

</div>

> [!IMPORTANT]
> This is a demo/portfolio project. It does not implement production-grade authentication, per-user conversation isolation, or regulatory compliance controls (PCI-DSS, GDPR, etc.). See [Security notes](#security-notes) before using it with real customer data.

## Architecture

A **triage agent** interprets each user request and hands it off to the right domain specialist — account, payment, transaction, loan, credit, customer, document, communication, or investment — each of which talks to its own independently deployable microservice over MCP (Model Context Protocol).

```
User ⇄ React chat UI ⇄ Backend orchestrator (triage + 9 specialist agents)
                              │
                              ├─ Account service       ├─ Loan service
                              ├─ Payment service        ├─ Credit service
                              ├─ Transaction service     ├─ Document service
                              ├─ Customer service        ├─ Communication service
                              └─ Investment service
```

Each microservice is its own container, independently deployed on Azure Container Apps — one service failing doesn't take down the rest.

## Features

- **Multi-agent handoff orchestration** — a supervisor agent routes intent to the correct domain specialist instead of one monolithic prompt trying to do everything.
- **Invoice image upload → automated bill pay** — attach a photo of a bill; Azure Document Intelligence extracts the payee, amount, and due date, then the assistant drives an approval-gated payment flow.
- **Human-in-the-loop approvals** — sensitive actions (payments, loan applications, investment orders) pause for explicit user confirmation before executing.
- **Two swappable LLM execution backends** — Azure AI Foundry Agent Service or direct Azure OpenAI chat completions, selectable via config, with measured latency tradeoffs between them.
- **Structured observability** — per-turn conversation logging (tool calls, latency, retries, agent handoff path) for debugging multi-agent behavior in real time.
- **Infrastructure as Code** — full Bicep templates and `azd`-based deployment to Azure Container Apps.

## Tech Stack

**Backend:** Python, FastAPI, Microsoft Agent Framework, Model Context Protocol (MCP/FastMCP), Azure OpenAI, Azure AI Foundry
**Frontend:** React, TypeScript, Vite, Tailwind CSS
**Data/AI services:** Azure Postgres, Azure Blob Storage, Azure Document Intelligence, Azure Cosmos DB
**Infrastructure:** Azure Container Apps, Bicep, Azure Developer CLI (`azd`), GitHub Actions

## Getting Started

### Prerequisites

- [Python >= 3.11](https://www.python.org/downloads/)
- [uv](https://github.com/astral-sh/uv)
- [Node.js](https://nodejs.org/en/download/)
- [Azure Developer CLI](https://aka.ms/azure-dev/install)
- An Azure subscription with `Microsoft.Authorization/roleAssignments/write` permissions

### Local development

Each Python service under `app/business-api/python/*` and `app/backend` runs independently:

```shell
uv sync --extra dev
uv run uvicorn app.main:app --port <service-port>
```

The frontend lives in `app/frontend/banking-web`:

```shell
npm install
npm run dev
```

See [`docs/deployment-guide.md`](./docs/deployment-guide.md) and [`docs/technical-architecture.md`](./docs/technical-architecture.md) for full setup details.

## Deployment

Provision and deploy everything to Azure with the Azure Developer CLI:

```shell
azd auth login
azd up
```

This provisions all Azure resources (Container Apps environment, Container Registry, Azure OpenAI/AI Foundry, storage, etc.) from the Bicep templates in `infra/`, then builds and deploys every service.

To tear it down: `azd down`.

## Security notes

This project is a functional demo, not a production-hardened banking system. Before using it with real customer data, you would need to add:

- End-user authentication and authorization
- Per-user conversation and data isolation
- Audit logging of all access and operations
- Compliance controls for applicable regulations (PCI-DSS, GDPR, local banking regulations)

## Acknowledgements

Built on top of [Microsoft Agent Framework](https://github.com/microsoft/agent-framework) and Azure AI Foundry, starting from Microsoft's multi-agent banking assistant reference architecture and extended with additional debugging, performance tuning, feature work, and a custom UI.

## License

MIT — see [LICENSE](./LICENSE).
