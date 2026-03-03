# Chat Agent Skills

This document describes the available skills (tools) the chat agent can use on behalf of users, and how to add new ones.

## How Skills Work

The chat agent uses **LangChain tool calling** — each skill is a Python function decorated with `@tool` that wraps a backend API call. When a user sends a message:

1. The **LLM** reads the skill descriptions and decides which (if any) to invoke.
2. The agent performs **token exchange** with Asgardeo to get a scoped access token for the target micro-app.
3. The tool function calls the backend API with the exchanged token.
4. The LLM formats the raw API response into a friendly, human-readable reply.

Skills are defined in `app/tools.py` and registered in `app/agent.py`.

---

## Available Skills

### `get_todays_menu`

| Property | Value |
|---|---|
| **File** | `app/tools.py` |
| **Backend** | Meals micro-app (`/menu` endpoint) |
| **Triggers** | User asks about food, meals, lunch, breakfast, snacks, cafeteria, today's menu |
| **Auth** | Token exchange → `x-jwt-assertion` header |
| **Returns** | Today's full menu (breakfast, juice, lunch, dessert, snack) with titles and descriptions |

**Example prompts:**
- "What's for lunch today?"
- "Show me today's menu"
- "Any snacks available?"

---

## Adding a New Skill

Follow these steps to add a new skill to the agent.

### Step 1: Define the Tool Function

Create a new `@tool` decorated async function in `app/tools.py`:

```python
from langchain_core.tools import tool

@tool
async def get_meeting_rooms(access_token: str) -> dict:
    """Get available meeting rooms for booking.
    Use this when the user asks about meeting rooms, booking a room,
    or room availability.

    Args:
        access_token: The exchanged access token for authentication (injected by the agent).
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            f"{FACILITIES_BACKEND_URL}/rooms",
            headers={
                "x-jwt-assertion": access_token,
                "Authorization": f"Bearer {access_token}",
            },
        )
        if response.status_code != 200:
            return {"error": f"Rooms API returned {response.status_code}: {response.text}"}
        return response.json()
```

> **Important**: The `access_token` parameter is automatically injected by the agent during execution. The docstring is critical — the LLM uses it to decide when to invoke the tool.

### Step 2: Register the Tool

Add your tool to the `tools` list in `app/agent.py`:

```python
from app.tools import get_todays_menu, get_meeting_rooms

tools = [get_todays_menu, get_meeting_rooms]
```

### Step 3: Update the System Prompt

Update `SYSTEM_PROMPT` in `app/agent.py` to tell the LLM when to use the new skill:

```python
SYSTEM_PROMPT = """You are a helpful workplace assistant integrated into the company's super app.
You help employees with their daily needs.

When the user asks about food, meals, today's menu, what's for lunch, breakfast, snacks,
or anything related to cafeteria food, use the get_todays_menu tool.

When the user asks about meeting rooms, booking a room, or room availability,
use the get_meeting_rooms tool.

...
"""
```

### Step 4: Add Configuration (if needed)

If your new skill requires a different backend URL or client ID, add the environment variables:

1. Add to `.env` and `.env.example`:
   ```
   FACILITIES_BACKEND_URL=https://apis.example.com/facilities/v1
   FACILITIES_APP_CLIENT_ID=your-client-id
   ```

2. Add to `app/config.py`:
   ```python
   FACILITIES_BACKEND_URL = os.getenv("FACILITIES_BACKEND_URL", "")
   FACILITIES_APP_CLIENT_ID = os.getenv("FACILITIES_APP_CLIENT_ID", "")
   ```

### Step 5: Handle Token Exchange (if different micro-app)

If the new skill calls a **different micro-app** backend (with its own OAuth client), you'll need to add a separate token exchange function in `app/token_exchange.py`:

```python
async def exchange_token_for_facilities(access_token: str) -> str:
    """Exchange super app token for a facilities-app-scoped token."""
    # Same as exchange_token_for_meals but using FACILITIES_APP_CLIENT_ID
    ...
```

And update `app/agent.py` to route the correct exchanged token to each tool based on the tool name.

---

## Skill Design Guidelines

1. **Docstring is everything** — The LLM uses the tool's docstring to decide when to call it. Be specific about trigger phrases and the kind of data it returns.
2. **Return raw data** — Let the LLM format the response. Return dictionaries or JSON, not pre-formatted strings.
3. **Handle errors gracefully** — Return `{"error": "..."}` instead of raising exceptions, so the LLM can explain the problem to the user.
4. **Keep tools focused** — One tool per API endpoint. Don't create a mega-tool that handles multiple unrelated queries.
5. **Always accept `access_token`** — The agent injects the exchanged token at runtime. Every tool function must accept this parameter.

---

## Potential Future Skills

| Skill | Backend | Description |
|---|---|---|
| `get_meeting_rooms` | Facilities API | Check available meeting rooms |
| `book_meeting_room` | Facilities API | Book a meeting room for a given time |
| `check_leave_balance` | HR API | Check remaining leave days |
| `submit_leave_request` | HR API | Submit a leave request |
| `get_company_events` | Events API | List upcoming company events |
| `search_employees` | Directory API | Look up employee contact info |
| `get_pay_slip` | Payroll API | Retrieve latest pay slip summary |
