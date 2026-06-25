"""Agent long-term memory — pgvector RAG.

Each memory is a row: which agent it belongs to, the text, and its embedding
(nomic-embed-text, 768 dims, local). `recall` is cosine-similarity search
scoped to one agent — an SDE2's agent remembers *its* briefings, not the
whole org's.
"""

import psycopg

from . import llm
from .config import settings
from .db import _nano

DDL = """
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS agent_memories (
  id text PRIMARY KEY,
  agent_name text NOT NULL,
  kind text NOT NULL DEFAULT 'note',
  content text NOT NULL,
  embedding vector(768) NOT NULL,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_memories_agent_idx ON agent_memories (agent_name);
"""


def ensure_schema() -> None:
    with psycopg.connect(settings.database_url) as c:
        c.execute(DDL)
        c.commit()


def _vec(v: list[float]) -> str:
    return "[" + ",".join(f"{x:.7f}" for x in v) + "]"


def remember(agent_name: str, content: str, kind: str = "note") -> None:
    from datetime import datetime, timezone

    [emb] = llm.embed([content])
    with psycopg.connect(settings.database_url) as c:
        c.execute(
            "insert into agent_memories (id, agent_name, kind, content, embedding, created_at) "
            "values (%s,%s,%s,%s,%s::vector,%s)",
            (_nano(), agent_name, kind, content, _vec(emb),
             datetime.now(timezone.utc).isoformat()),
        )
        c.commit()


def recall(agent_name: str, query: str, k: int = 3) -> list[tuple[str, float]]:
    """Top-k memories for this agent by cosine similarity: (content, score)."""
    [emb] = llm.embed([query])
    with psycopg.connect(settings.database_url) as c, c.cursor() as cur:
        cur.execute(
            "select content, 1 - (embedding <=> %s::vector) as score "
            "from agent_memories where agent_name = %s "
            "order by embedding <=> %s::vector limit %s",
            (_vec(emb), agent_name, _vec(emb), k),
        )
        return cur.fetchall()
