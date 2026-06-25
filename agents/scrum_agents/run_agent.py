"""Run ONE teammate's agent as its own process — the unit you'd put on a laptop.

  python -m scrum_agents.run_agent --name "Priya Nair" --role pm --project demo \
      --listen 8 --say "Standup in 10 — push your status."

Each process connects to the real NATS bus, subscribes to its team's broadcast
subject and its own inbox, and prints whatever it hears from peers.
"""

import argparse
import asyncio
import json
import re

from . import bus, db
from .bus import BusMessage


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def my_status(project: str, name: str, last_say: str | None) -> str:
    """What this agent reports at standup: its owner's real task state from
    the shared DB, falling back to whatever it last said on the bus."""
    try:
        rows = db.tasks_for_member_name(project, name)
    except Exception:
        rows = []
    if rows:
        return "; ".join(f'"{title}" is {ws.replace("_", " ")}' for title, ws in rows)
    return last_say or "No tracked work right now."


async def run(name: str, role: str, project: str, listen: float, say: str | None, kind: str = "progress") -> None:
    nc, js = await bus.connect()
    await bus.ensure_bus_stream(js)

    heard: list[BusMessage] = []

    async def on_message(msg) -> None:
        m = BusMessage.decode(msg.data)
        if m.sender == name:
            return  # ignore our own broadcast
        heard.append(m)
        print(f"   ↳ {name} ({role}) heard {m.sender} ({m.role}) [{m.kind}]: {m.text}", flush=True)

    async def on_standup_request(msg) -> None:
        status = my_status(project, name, say)
        await msg.respond(json.dumps({"sender": name, "role": role, "status": status}).encode())
        print(f"   ⇡ {name} ({role}) answered standup: {status}", flush=True)

    await nc.subscribe(bus.team_bus(project), cb=on_message)
    await nc.subscribe(bus.agent_inbox(project, slug(name)), cb=on_message)
    await nc.subscribe(bus.standup_request(project), cb=on_standup_request)
    print(f"● {name} ({role}) online — listening on {bus.team_bus(project)}", flush=True)

    if say:
        await asyncio.sleep(2)  # let peers finish subscribing
        await nc.publish(bus.team_bus(project), BusMessage(name, role, kind, say).encode())
        print(f"➤ {name} broadcast: {say}", flush=True)

    await asyncio.sleep(listen)
    await nc.drain()
    print(f"■ {name} offline — heard {len(heard)} message(s)", flush=True)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--name", required=True)
    p.add_argument("--role", required=True)
    p.add_argument("--project", default="demo")
    p.add_argument("--listen", type=float, default=8.0)
    p.add_argument("--say", default=None)
    p.add_argument("--kind", default="progress")
    a = p.parse_args()
    asyncio.run(run(a.name, a.role, a.project, a.listen, a.say, a.kind))


if __name__ == "__main__":
    main()
