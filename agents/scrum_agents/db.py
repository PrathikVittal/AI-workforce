"""Postgres access for the agent service — the shared state with the web app.

Ids and timestamps are generated app-side (the Drizzle columns have no DB
default), so we mint them here too when inserting.
"""

import secrets
import string
from datetime import datetime, timezone

import psycopg

from .config import settings

_ALPHABET = string.ascii_letters + string.digits


def _nano(n: int = 12) -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(n))


def get_project() -> tuple[str, str] | None:
    with psycopg.connect(settings.database_url) as c, c.cursor() as cur:
        cur.execute("select id, name from projects limit 1")
        return cur.fetchone()


def agent_id_for_name(project_id: str, name: str) -> str | None:
    with psycopg.connect(settings.database_url) as c, c.cursor() as cur:
        cur.execute(
            "select a.id from agents a join members m on m.id = a.member_id "
            "where a.project_id = %s and m.name = %s limit 1",
            (project_id, name),
        )
        row = cur.fetchone()
        return row[0] if row else None


def insert_bus_event(
    project_id: str,
    from_agent_id: str,
    kind: str,
    content: str,
    related_task_id: str | None = None,
    audience: str = "team",
) -> None:
    with psycopg.connect(settings.database_url) as c, c.cursor() as cur:
        cur.execute(
            "insert into bus_events "
            "(id, project_id, from_agent_id, to_agent_id, kind, content, related_task_id, audience, created_at) "
            "values (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (
                _nano(),
                project_id,
                from_agent_id,
                None,
                kind,
                content,
                related_task_id,
                audience,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        c.commit()


def tasks_for_member_name(project_id: str, name: str) -> list[tuple[str, str]]:
    """Committed (non-draft) tasks owned by this member: (title, work_status)."""
    with psycopg.connect(settings.database_url) as c, c.cursor() as cur:
        cur.execute(
            "select t.title, t.work_status from tasks t "
            "join members m on m.id = t.assignee_id "
            "where t.project_id = %s and m.name = %s and t.status != 'draft' "
            "order by t.created_at",
            (project_id, name),
        )
        return cur.fetchall()


def count_bus_events(project_id: str) -> int:
    with psycopg.connect(settings.database_url) as c, c.cursor() as cur:
        cur.execute("select count(*) from bus_events where project_id = %s", (project_id,))
        return cur.fetchone()[0]
