"""L3 — the LangGraph stateful runtime.

The meeting pipeline as a durable graph:

    extract ──► brief ──► remember
    (CrewAI)    (LLM)     (pgvector)

Every step's state is checkpointed to Postgres (langgraph-checkpoint-postgres),
so a run is resumable and auditable: kill the process after `extract` and the
next invoke picks up at `brief` with the extracted tasks intact. This is the
durability layer the hand-rolled engines didn't have.
"""

import re
from typing import TypedDict

from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import END, START, StateGraph

from . import crew, llm, memory
from .config import settings


class PipelineState(TypedDict, total=False):
    transcript: str
    roster: list[dict]          # [{"name","role"}]
    tasks: list[dict]           # extracted by the crew
    briefings: list[dict]       # [{"assignee","text"}]
    remembered: int             # memories written


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def extract_node(state: PipelineState) -> PipelineState:
    tasks = crew.extract_tasks(state["transcript"], state["roster"])
    return {"tasks": tasks}


def brief_node(state: PipelineState) -> PipelineState:
    briefings = []
    for t in state.get("tasks", []):
        assignee = t.get("assignee")
        if not assignee:
            continue
        text = llm.complete(
            f'Write a 1-2 sentence briefing to {assignee} telling them they now own '
            f'"{t.get("title")}" (priority {t.get("priority", "medium")}). '
            "Second person, direct, warm but brief.",
            system="You are the team's lead agent briefing a teammate's agent.",
        )
        briefings.append({"assignee": assignee, "text": text})
    return {"briefings": briefings}


def remember_node(state: PipelineState) -> PipelineState:
    memory.ensure_schema()
    n = 0
    for b in state.get("briefings", []):
        memory.remember(f"{_slug(b['assignee'])}-agent", b["text"], kind="briefing")
        n += 1
    return {"remembered": n}


def build_graph(checkpointer) -> object:
    g = StateGraph(PipelineState)
    g.add_node("extract", extract_node)
    g.add_node("brief", brief_node)
    g.add_node("remember", remember_node)
    g.add_edge(START, "extract")
    g.add_edge("extract", "brief")
    g.add_edge("brief", "remember")
    g.add_edge("remember", END)
    return g.compile(checkpointer=checkpointer)


def open_checkpointer():
    """Context manager yielding a Postgres-backed checkpointer (tables auto-created)."""
    return PostgresSaver.from_conn_string(settings.database_url)
