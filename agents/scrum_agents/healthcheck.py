"""Verify the agent service can reach all three local dependencies.

Run:  cd agents && .venv/bin/python -m scrum_agents.healthcheck
"""

import asyncio

import nats
import psycopg

from . import llm
from .config import settings


def check_llm() -> str:
    out = llm.complete("Reply with exactly one word: OK")
    return f"OK — {out!r} via {llm.litellm_model()}"


def check_db() -> str:
    with psycopg.connect(settings.database_url) as conn, conn.cursor() as cur:
        cur.execute("select 1")
        cur.fetchone()
    return f"OK — {settings.database_url}"


async def check_nats() -> str:
    nc = await nats.connect(settings.nats_url)
    sub = await nc.subscribe("health.ping")
    await nc.publish("health.ping", b"pong")
    msg = await sub.next_msg(timeout=2)
    await nc.drain()
    return f"OK — round-trip {msg.data.decode()!r} on {settings.nats_url}"


async def main() -> None:
    for label, coro in (
        ("LLM     ", check_llm),
        ("Postgres", check_db),
    ):
        try:
            print(f"{label}: {coro()}")
        except Exception as e:  # noqa: BLE001 - report-only
            print(f"{label}: FAIL — {e}")
    try:
        print(f"NATS    : {await check_nats()}")
    except Exception as e:  # noqa: BLE001
        print(f"NATS    : FAIL — {e}")


if __name__ == "__main__":
    asyncio.run(main())
