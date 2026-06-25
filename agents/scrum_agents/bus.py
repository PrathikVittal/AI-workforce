"""L1 — the NATS gossip bus.

Subject layout encodes team boundaries:
  scrum.team.{project}.bus            broadcast gossip to the whole team
  scrum.team.{project}.agent.{id}     directed message to one agent (e.g. briefings)

A JetStream stream (SCRUM_BUS) captures everything under scrum.team.> so the
chatter is durable — late joiners and standup history can read it back.
"""

import json
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone

import nats
from nats.js import JetStreamContext

from .config import settings

BUS_STREAM = "SCRUM_BUS"


def team_bus(project: str) -> str:
    return f"scrum.team.{project}.bus"


def agent_inbox(project: str, agent_id: str) -> str:
    return f"scrum.team.{project}.agent.{agent_id}"


def standup_request(project: str) -> str:
    """Scatter-gather subject: the lead requests status, every teammate's
    agent process replies to the lead's inbox."""
    return f"scrum.team.{project}.standup.request"


@dataclass
class BusMessage:
    sender: str
    role: str
    kind: str  # gossip | briefing | progress | blocker | standup
    text: str
    ts: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def encode(self) -> bytes:
        return json.dumps(asdict(self)).encode()

    @staticmethod
    def decode(data: bytes) -> "BusMessage":
        return BusMessage(**json.loads(data.decode()))


async def connect():
    nc = await nats.connect(settings.nats_url)
    return nc, nc.jetstream()


async def ensure_bus_stream(js: JetStreamContext) -> None:
    # Persist only broadcast/directed chatter — NOT request/reply subjects like
    # standup.request, or JetStream pub-acks leak into reply inboxes.
    subjects = ["scrum.team.*.bus", "scrum.team.*.agent.>"]
    try:
        info = await js.stream_info(BUS_STREAM)
        if set(info.config.subjects or []) != set(subjects):
            await js.update_stream(name=BUS_STREAM, subjects=subjects)
    except Exception:
        await js.add_stream(name=BUS_STREAM, subjects=subjects)
