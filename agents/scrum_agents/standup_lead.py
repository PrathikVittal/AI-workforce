"""The fully distributed standup.

The lead agent broadcasts a status request on the team's standup subject;
every teammate agent *process* answers over NATS request/reply with its
owner's real task state. The lead gathers the replies, has the CrewAI crew
synthesize them, and publishes the standup on the bus — where the bridge
lands it in Postgres and the web /mesh page picks it up.

  python -m scrum_agents.standup_lead --project <project-id> --wait 5
"""

import argparse
import asyncio
import json

from . import bus, crew
from .bus import BusMessage


async def gather_statuses(nc, project: str, wait: float) -> list[dict]:
    replies: list[dict] = []
    inbox = nc.new_inbox()

    async def on_reply(msg) -> None:
        try:
            r = json.loads(msg.data.decode())
        except Exception:
            return
        # Only accept well-formed agent replies (ignore e.g. JetStream acks).
        if isinstance(r, dict) and {"sender", "role", "status"} <= r.keys():
            replies.append(r)

    sub = await nc.subscribe(inbox, cb=on_reply)
    await nc.publish(bus.standup_request(project), b"standup", reply=inbox)
    await asyncio.sleep(wait)  # collect everyone who answers in time
    await sub.unsubscribe()
    return replies


async def main(project: str, wait: float, lead_name: str, lead_role: str) -> None:
    nc, js = await bus.connect()
    await bus.ensure_bus_stream(js)

    print(f"➤ {lead_name} ({lead_role}) requesting standup from the team…", flush=True)
    replies = await gather_statuses(nc, project, wait)
    if not replies:
        print("No agents answered — are teammate processes running?")
        await nc.drain()
        return

    print(f"✓ {len(replies)} agent(s) replied:", flush=True)
    signals = []
    for r in replies:
        line = f"{r['sender']} ({r['role']}): {r['status']}"
        signals.append(line)
        print(f"   • {line}", flush=True)

    print("\n… synthesizing with the lead crew (local LLM)…", flush=True)
    report = await crew.run_standup_async(signals)

    await nc.publish(
        bus.team_bus(project),
        BusMessage(lead_name, lead_role, "standup", report).encode(),
    )
    await nc.drain()
    print(f"\n=== Standup (published to the bus) ===\n{report}", flush=True)


def cli() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--project", required=True)
    p.add_argument("--wait", type=float, default=5.0)
    p.add_argument("--name", default="Priya Nair")
    p.add_argument("--role", default="pm")
    a = p.parse_args()
    asyncio.run(main(a.project, a.wait, a.name, a.role))


if __name__ == "__main__":
    cli()
