# Scrum Agents — Python agent service

The distributed half of Scrum Agents: a Python sidecar that runs the real
**L1–L4** stack locally — NATS bus, MCP tools, and a CrewAI lead crew on a
local (or cloud) LLM. The Next.js app is the control plane / UI; this service
is the agents.

```
Next.js (control plane, Postgres)
   ▲   bridge mirrors gossip → Postgres
   │
NATS bus ── agent processes (one per teammate)
   │
CrewAI crew (LangGraph-ready) ── Ollama qwen2.5:7b  ⇄  API toggle
MCP filesystem server ── agents read real code
```

## Prerequisites (local, free)

Installed via Homebrew; started once per boot:

```bash
brew services start ollama postgresql@16 redis
nats-server -js --store_dir /tmp/scrum-nats &     # JetStream bus on :4222
ollama pull qwen2.5:7b && ollama pull nomic-embed-text
```

The web app must be seeded first (creates the project/members/agents the
bridge maps onto):

```bash
cd ..        # repo root
npm run db:reset
```

## Setup

```bash
python3.13 -m venv .venv          # CrewAI needs Python ≤ 3.13
.venv/bin/pip install -r requirements.txt
```

## Configuration

Defaults are all local. To switch the LLM to the cloud API, set in `.env`:

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

(See `.env.example`. Without it, everything runs on local Ollama for $0.)

## Commands

```bash
# Verify NATS + Postgres + LLM are all reachable
.venv/bin/python -m scrum_agents.healthcheck

# L4 — CrewAI lead crew: extract tasks from a transcript + run a standup
.venv/bin/python -m scrum_agents.run_crew

# L2 — MCP: an agent reads real code from this repo and reviews it
.venv/bin/python -m scrum_agents.run_mcp_demo

# L2 — MCP: read real commits via GitHub for a velocity report
#      (token auto-detected from GITHUB_TOKEN or `gh auth login`)
.venv/bin/python -m scrum_agents.run_github_demo --repo owner/repo

# L1 — read the durable bus back from JetStream
.venv/bin/python -m scrum_agents.dump_bus

# L3 — LangGraph stateful pipeline: extract → brief → remember,
#      checkpointed in Postgres, briefings stored as pgvector memories
.venv/bin/python -m scrum_agents.run_graph
```

### The fully distributed standup

Teammate processes answer the lead over NATS request/reply with their real
task state from Postgres; the crew synthesizes; the bridge lands the result
in the web UI:

```bash
PID=$(.venv/bin/python -c "from scrum_agents import db; print(db.get_project()[0])")
.venv/bin/python -m scrum_agents.bridge &
.venv/bin/python -m scrum_agents.run_agent --name "Aisha Khan"   --role sde2 --project "$PID" --listen 300 &
.venv/bin/python -m scrum_agents.run_agent --name "Diego Santos" --role sde2 --project "$PID" --listen 300 &
.venv/bin/python -m scrum_agents.standup_lead --project "$PID" --wait 5
# → the standup appears on the web /mesh page
```

### Run the mesh (one process per teammate)

Each in its own terminal — they gossip over the real bus:

```bash
.venv/bin/python -m scrum_agents.run_agent --name "Priya Nair" --role pm   --listen 30 --say "Standup in 10"
.venv/bin/python -m scrum_agents.run_agent --name "Aisha Khan" --role sde2 --listen 30
.venv/bin/python -m scrum_agents.run_agent --name "Lena Ortiz" --role qa   --listen 30
```

### Bridge the mesh into the web UI

Run the bridge, then point agents at the real project so their gossip lands in
Postgres and shows up on the web `/mesh` page:

```bash
PID=$(.venv/bin/python -c "from scrum_agents import db; print(db.get_project()[0])")
.venv/bin/python -m scrum_agents.bridge &     # mirrors NATS → Postgres
.venv/bin/python -m scrum_agents.run_agent --name "Aisha Khan" --role sde2 \
    --project "$PID" --kind progress --say "Wired up password-reset; PR open."
```

Then open the web app (`npm run dev` in the repo root) → **/mesh**.

## Layout

| File | Layer | Role |
|---|---|---|
| `config.py` | — | env config + LLM toggle |
| `llm.py` | — | unified LLM (Ollama / OpenAI) |
| `bus.py` | L1 | NATS subjects + JetStream stream |
| `run_agent.py` | L1 | one teammate's agent process |
| `dump_bus.py` | L1 | read the durable bus |
| `bridge.py` | L1→state | mirror NATS gossip into Postgres |
| `db.py` | state | Postgres access (shared with the web app) |
| `crew.py` | L4 | CrewAI lead crew (extract + standup) |
| `standup_lead.py` | L1+L4 | distributed standup: scatter-gather + crew |
| `graph.py` | L3 | LangGraph pipeline, Postgres-checkpointed |
| `memory.py` | L3 | pgvector RAG memory (remember / recall) |
| `mcp_tools.py` | L2 | MCP clients: filesystem + GitHub |
| `healthcheck.py` | — | verify all deps reachable |

> pgvector note: the brew bottle targets PG17/18; this repo's extension was
> built from source against `postgresql@16` (`make PG_CONFIG=.../pg_config`).
