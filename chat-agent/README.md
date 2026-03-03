# OpenSuperApp Chat Agent

The **Chat Agent** is an AI-powered conversational backend service for OpenSuperApp. It uses **LangChain** with **OpenAI GPT-4o** to provide an intelligent assistant that can answer employee queries by calling micro-app backend APIs on their behalf.

The agent follows the same token exchange authentication pattern used by micro-apps in the Super App — it receives the super app's access token, exchanges it for a micro-app-scoped token via Asgardeo, and then calls the relevant backend APIs.

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│                     Super App (Mobile)                     │
│                                                           │
│  User sends message ──► chatService.ts                    │
│                         (Bearer access_token)             │
└────────────────────────────┬──────────────────────────────┘
                             │ POST /chat
                             ▼
┌───────────────────────────────────────────────────────────┐
│                     Chat Agent (FastAPI)                   │
│                                                           │
│  1. Receive message + super app access_token              │
│  2. LLM decides which tool(s) to call                     │
│  3. Token exchange: super app token → micro-app token     │
│  4. Call micro-app backend API with exchanged token       │
│  5. LLM formats the API response into a friendly reply   │
└──────────┬────────────────────────────┬──────────────────┘
           │ Token Exchange (RFC 8693)  │ API Call
           ▼                            ▼
┌──────────────────┐    ┌──────────────────────────────────┐
│  Asgardeo IAM    │    │  Micro-App Backend (e.g. Meals)  │
│  (OAuth2 Token   │    │  x-jwt-assertion auth            │
│   Exchange)      │    │                                  │
└──────────────────┘    └──────────────────────────────────┘
```

### Token Exchange Flow

The chat agent mirrors the Super App's micro-app authentication pattern:

1. The mobile app sends its **super app access token** in the `Authorization: Bearer` header.
2. The agent performs an **OAuth 2.0 Token Exchange** (RFC 8693) with Asgardeo, exchanging the super app token for a token scoped to the target micro-app.
3. The exchanged token is passed to backend APIs via the `x-jwt-assertion` header.

This ensures the agent never needs its own service credentials — it always acts on behalf of the authenticated user.

## Project Structure

```bash
chat-agent/
├── .env.example          # Environment variable template
├── .gitignore            # Git ignore rules
├── requirements.txt      # Python dependencies
├── SKILLS.md             # Agent skills/tools documentation
├── README.md             # This file
└── app/
    ├── __init__.py       # Package marker
    ├── main.py           # FastAPI entry point (endpoints)
    ├── agent.py          # LangChain agent orchestration
    ├── config.py         # Environment variable loader
    ├── token_exchange.py # Asgardeo OAuth2 token exchange
    └── tools.py          # LangChain tools (backend API wrappers)
```

## Prerequisites

- **Python 3.11+**
- **OpenAI API key** with access to GPT-4o (or another supported model)
- **Asgardeo tenant** with Token Exchange grant enabled on the target micro-app's OAuth application
- Network access to the micro-app backend APIs

## Setup

### 1. Create a Virtual Environment

```bash
cd chat-agent
python3 -m venv .venv
source .venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description | Required |
|---|---|---|
| `OPENAI_API_KEY` | Your OpenAI API key | Yes |
| `OPENAI_MODEL` | OpenAI model to use (default: `gpt-4o`) | No |
| `MEALS_BACKEND_URL` | Base URL of the Meals micro-app backend API | Yes |
| `ASGARDEO_TOKEN_URL` | Asgardeo OAuth2 token endpoint for your tenant | Yes |
| `MEALS_APP_CLIENT_ID` | OAuth2 client ID of the Meals app in Asgardeo (used for token exchange) | Yes |

> **Important**: The Meals app's OAuth application in Asgardeo must have the **Token Exchange** grant type enabled. See [Asgardeo Token Exchange docs](https://wso2.com/asgardeo/docs/guides/authentication/oidc/implement-token-exchange/).

### 4. Start the Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The server will be available at `http://localhost:8000`.

> **Note for physical device testing**: Use your machine's LAN IP (e.g., `http://10.100.5.158:8000`) instead of `localhost`. Update the frontend's `EXPO_PUBLIC_CHAT_AGENT_URL` accordingly.

## API Endpoints

| Endpoint | Method | Description | Auth |
|---|---|---|---|
| `/health` | GET | Health check | None |
| `/chat` | POST | Send a chat message | Bearer token required |

### POST /chat

**Request:**

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <super_app_access_token>" \
  -d '{"message": "What'\''s for lunch today?"}'
```

**Response:**

```json
{
  "reply": "Here's today's menu:\n\n**Lunch:**\n- **Spirit Kitchen**: Chicken curry with rice..."
}
```

**Error Responses:**

| Status | Description |
|---|---|
| 401 | Missing or invalid Authorization header |
| 500 | Agent processing error (LLM failure, token exchange failure, etc.) |

## Adding New Skills

See [SKILLS.md](./SKILLS.md) for a guide on the available agent skills and how to add new ones.

## Technologies

- **[FastAPI](https://fastapi.tiangolo.com/)** — Async Python web framework
- **[LangChain](https://python.langchain.com/)** — LLM orchestration with tool calling
- **[OpenAI GPT-4o](https://platform.openai.com/)** — Large language model
- **[httpx](https://www.python-httpx.org/)** — Async HTTP client for backend API calls
- **[Asgardeo](https://wso2.com/asgardeo/)** — Identity provider (OAuth2 token exchange)

## License

Licensed under Apache 2.0. See the [LICENSE](../LICENSE) file for details.
