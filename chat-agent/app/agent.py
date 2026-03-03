# Copyright (c) 2025 WSO2 LLC. (https://www.wso2.com).
#
# WSO2 LLC. licenses this file to you under the Apache License,
# Version 2.0 (the "License"); you may not use this file except
# in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.

"""
Chat agent powered by OpenAI GPT-4o with LangChain tool calling.

The agent receives a user message, decides whether to call backend tools
(e.g., fetching the menu), and returns a friendly response.
"""

import logging

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.config import OPENAI_API_KEY, OPENAI_MODEL
from app.token_exchange import exchange_token_for_meals
from app.tools import get_todays_menu

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a helpful workplace assistant integrated into the company's super app.
You help employees with their daily needs.

When the user asks about food, meals, today's menu, what's for lunch, breakfast, snacks, or anything related to cafeteria food, use the get_todays_menu tool to fetch the current menu.

Format menu responses in a clear, readable way with meal categories (Breakfast, Juice, Lunch, Dessert, Snack). Include both the title and description for each item.

If the user asks about something you don't have a tool for, respond politely and helpfully:
1. Let them know you can't perform that action directly through the chat yet.
2. Suggest which micro app or web app they should use instead. Use the following mapping:
   - Leave / time-off / PTO / vacation requests → **Leave App** (available in My Apps)
   - Meeting room bookings → **Facilities App** (available in My Apps)
   - Pay slips / salary / payroll → **Payroll App** (available in My Apps)
   - IT support / tickets → **IT Helpdesk App** (available in My Apps)
   - Company events / gatherings → Check the **Feed** tab for upcoming events
   - Employee directory / contacts → **People Directory App** (available in My Apps)
   - Any other request → Suggest checking the **My Apps** tab in the super app for relevant apps
3. Mention that more features are being added to the chat assistant regularly.

Currently, you can only help with:
- Checking today's cafeteria menu (breakfast, lunch, snacks, desserts)

Keep responses concise and friendly.
"""

# Available tools for the agent
tools = [get_todays_menu]


async def run_agent(message: str, access_token: str) -> str:
    """
    Run the chat agent with a user message.

    Args:
        message: The user's chat message.
        access_token: The user's access token for authenticating with backend services.

    Returns:
        The agent's text response.
    """
    llm = ChatOpenAI(
        model=OPENAI_MODEL,
        api_key=OPENAI_API_KEY,
        temperature=0.3,
    )

    # Bind tools to the LLM so it can decide when to call them
    llm_with_tools = llm.bind_tools(tools)

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=message),
    ]

    # First LLM call — may produce tool calls or a direct response
    response: AIMessage = await llm_with_tools.ainvoke(messages)

    # If the LLM decided to call tools, execute them and get a final answer
    if response.tool_calls:
        messages.append(response)

        # Do token exchange once for all tool calls
        try:
            exchanged_token = await exchange_token_for_meals(access_token)
            logger.info("Token exchange succeeded")
        except Exception as e:
            logger.error("Token exchange failed: %s", e)
            return f"Sorry, I couldn't authenticate with the meals service. Please try again later."

        for tool_call in response.tool_calls:
            tool_name = tool_call["name"]
            tool_args = tool_call["args"]

            # Inject the exchanged token into every tool call
            tool_args["access_token"] = exchanged_token

            # Find and execute the matching tool
            matched_tool = next(
                (t for t in tools if t.name == tool_name), None
            )
            if matched_tool:
                try:
                    result = await matched_tool.ainvoke(tool_args)
                    messages.append(
                        {
                            "role": "tool",
                            "content": str(result),
                            "tool_call_id": tool_call["id"],
                        }
                    )
                except Exception as e:
                    messages.append(
                        {
                            "role": "tool",
                            "content": f"Error fetching data: {str(e)}",
                            "tool_call_id": tool_call["id"],
                        }
                    )

        # Second LLM call — produce a human-readable response from tool results
        final_response = await llm_with_tools.ainvoke(messages)
        return final_response.content

    # No tool calls — return the direct response
    return response.content
