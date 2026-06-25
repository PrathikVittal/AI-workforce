"""The bridge — mirrors the live NATS gossip into Postgres so the Next.js web
UI (/mesh, /board) shows the real distributed agent activity.

  python -m scrum_agents.bridge

It resolves the seeded project, subscribes to that team's bus subject, maps
each message's sender name to its agent row, and inserts a bus_events record.
"""

import asyncio

from . import bus, db
from .bus import BusMessage

VALID_KINDS = {"briefing", "progress", "blocker", "standup", "note"}


async def main() -> None:
    proj = db.get_project()
    if not proj:
        print("No project in Postgres — seed the web app first (npm run db:reset).")
        return
    project_id, project_name = proj

    nc, js = await bus.connect()
    await bus.ensure_bus_stream(js)
    subject = bus.team_bus(project_id)
    print(f"Bridge online — {subject} → Postgres bus_events  ({project_name})", flush=True)

    async def on_message(msg) -> None:
        m = BusMessage.decode(msg.data)
        agent_id = db.agent_id_for_name(project_id, m.sender)
        if not agent_id:
            print(f"  · skip {m.sender!r} — no matching agent in this project", flush=True)
            return
        kind = m.kind if m.kind in VALID_KINDS else "note"
        db.insert_bus_event(project_id, agent_id, kind, m.text)
        print(f"  ✓ persisted [{kind}] {m.sender}: {m.text}", flush=True)

    await nc.subscribe(subject, cb=on_message)
    print("Listening… (Ctrl-C to stop)", flush=True)
    while True:
        await asyncio.sleep(3600)


if __name__ == "__main__":
    asyncio.run(main())
