"""Read the durable bus back from JetStream — proves the gossip was persisted,
independent of who was online when it was sent.

  python -m scrum_agents.dump_bus
"""

import asyncio

from . import bus
from .bus import BusMessage


async def main() -> None:
    nc, js = await bus.connect()
    await bus.ensure_bus_stream(js)
    info = await js.stream_info(bus.BUS_STREAM)
    print(f"SCRUM_BUS holds {info.state.messages} persisted message(s):")

    sub = await js.pull_subscribe("scrum.team.>", durable=None)
    try:
        msgs = await sub.fetch(50, timeout=2)
    except Exception:
        msgs = []
    for msg in msgs:
        m = BusMessage.decode(msg.data)
        print(f"  • [{m.kind}] {m.sender} ({m.role}): {m.text}")
        await msg.ack()
    await nc.drain()


if __name__ == "__main__":
    asyncio.run(main())
