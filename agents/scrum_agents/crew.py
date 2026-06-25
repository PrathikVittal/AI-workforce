"""L4 — the CrewAI lead crew, running on whatever LLM config.py selects.

The lead agent carries the authority of the project lead. Today it does two
jobs: turn a transcript into role-assigned tickets, and synthesize a standup
from the signals teammates' agents put on the bus.
"""

import json
import re

from crewai import Agent, Crew, LLM, Process, Task

from .config import settings


def _crew_llm() -> LLM:
    if settings.llm_provider == "openai":
        return LLM(model=f"openai/{settings.openai_model}", api_key=settings.openai_api_key, temperature=0.2)
    # litellm's ollama provider; base_url also honored via OLLAMA_API_BASE env.
    return LLM(model=f"ollama/{settings.ollama_model}", base_url="http://localhost:11434", temperature=0.2)


def lead_agent() -> Agent:
    return Agent(
        role="Scrum Master / Lead Agent",
        goal="Turn team discussion into concrete, role-assigned engineering tasks, and give crisp standups.",
        backstory=(
            "You are the lead agent for a software team, carrying the authority of the project "
            "lead. You are precise, never invent work, and always assign by role fit."
        ),
        llm=_crew_llm(),
        verbose=False,
        allow_delegation=False,
    )


def _first_json(text: str) -> dict:
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return {}
    try:
        return json.loads(m.group(0))
    except Exception:
        return {}


def extract_tasks(transcript: str, roster: list[dict]) -> list[dict]:
    roster_text = "\n".join(f"- {m['name']} ({m['role']})" for m in roster)
    task = Task(
        description=(
            "Extract the concrete engineering tasks the team decided to do in this meeting. "
            "One task per distinct piece of work. Assign each to the best-fit person from the "
            "roster by role (never assign to a PM). Only include work actually discussed.\n\n"
            f"Roster:\n{roster_text}\n\nTranscript:\n\"\"\"\n{transcript}\n\"\"\"\n\n"
            'Return STRICT JSON only: '
            '{"tasks":[{"title":"...","assignee":"<roster name>","priority":"low|medium|high","estimate":"e.g. 2d"}]}'
        ),
        expected_output='A JSON object with a "tasks" array.',
        agent=lead_agent(),
    )
    crew = Crew(agents=[task.agent], tasks=[task], process=Process.sequential, verbose=False)
    out = _first_json(str(crew.kickoff()))
    return out.get("tasks", []) if isinstance(out, dict) else []


def _standup_crew(signals: list[str]) -> Crew:
    bullet = "\n".join(f"- {s}" for s in signals)
    task = Task(
        description=(
            "These are the latest status signals from the team's agents on the bus:\n"
            f"{bullet}\n\n"
            "Give a crisp spoken-style standup: what's done, what's in progress, what's blocked "
            "(and the risk), and a one-line outlook. Under 120 words. Plain text, no markdown headers."
        ),
        expected_output="A short standup briefing in plain text.",
        agent=lead_agent(),
    )
    return Crew(agents=[task.agent], tasks=[task], process=Process.sequential, verbose=False)


def run_standup(signals: list[str]) -> str:
    return str(_standup_crew(signals).kickoff()).strip()


async def run_standup_async(signals: list[str]) -> str:
    """For callers already inside an event loop (e.g. the NATS standup lead)."""
    return str(await _standup_crew(signals).kickoff_async()).strip()
