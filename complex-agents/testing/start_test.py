import pytest
import pytest_asyncio
import sys
from pathlib import Path
from livekit.agents import AgentSession
from livekit.agents.voice.run_result import mock_tools
from livekit.plugins import openai
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent.parent.parent / '.env')

from agent import FunctionAgent

@pytest.mark.asyncio
async def test_assistant_greeting() -> None:
    async with (
        openai.LLM(model="gpt-4o-mini") as llm,
        AgentSession(llm=llm) as session,
    ):
        await session.start(FunctionAgent())
        result = await session.run(user_input="Hello")

        await result.expect.next_event().is_message(role="assistant").judge(
            llm, intent="Makes a friendly introduction and offers assistance."
        )