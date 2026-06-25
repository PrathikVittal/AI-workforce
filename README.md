# AI Workforce

An AI agent org that listens to your team meetings, understands your project
context, and turns the discussion into assigned, PM-approved tickets.

This repo is **v1: the core pipeline** —

```
transcript  →  lead agent extracts tasks  →  PM reviews & approves  →  team board
```

Everything runs locally for **$0**: a file-based SQLite DB and a built-in
heuristic task extractor. Add an OpenAI key to upgrade the extractor to
GPT-4o-mini.

## Quickstart

```bash
npm install
cp .env.example .env        # defaults work as-is
npm run db:reset            # create schema + seed a demo company
npm run dev                 # http://localhost:3000
```

`db:reset` seeds a demo project ("Orbit — Customer Portal"), a 6-person team
with roles (PM, Tech Lead, SDE II ×2, SDE I, QA), and one processed meeting so
every screen has data on first load.

## How it works

- **Dashboard** (`/`) — the project, the team (each member is a future agent
  with a role), and recent meetings.
- **New meeting** (`/meeting/new`) — paste a transcript. The **lead agent**
  (acting Scrum Master) extracts the concrete tasks, picks an owner by role
  fit, sets priority + estimate, and saves them as drafts.
- **Review** (`/review/[id]`) — the human-in-the-loop. Edit assignee/priority,
  reject, or **Approve all** in one click.
- **Board** (`/board`) — approved work grouped by owner. "Push" is simulated
  for now; a real Jira/Linear adapter slots in at `pushTask` in
  `src/lib/actions.ts`.

### The extractor

`src/lib/llm/extract.ts` has two paths:

- **With `OPENAI_API_KEY`** → GPT-4o-mini returns structured tasks with smart,
  role-aware assignment.
- **Without a key** → a deterministic heuristic finds action items and
  round-robins owners, so the whole app still works for free. The PM fixes
  assignments in review.

## Scripts

| script             | what it does                                  |
| ------------------ | --------------------------------------------- |
| `npm run dev`      | start the app                                 |
| `npm run db:reset` | drop DB, regenerate schema, migrate, reseed   |
| `npm run db:seed`  | reseed demo data                              |
| `npm run db:generate` / `db:migrate` | Drizzle schema → SQL → apply |

## Stack

Next.js 15 · React 19 · Drizzle ORM · libSQL (local SQLite) · OpenAI
(optional) · Tailwind v4.

## Roadmap

- **v2 — the agent mesh:** give every team member a role-scoped sub-agent
  (RBAC), have the lead agent brief them post-meeting, and let them gossip
  status over a shared `team_bus`.
- **Standup:** ask the lead agent for "what's done / pending / projected
  timeline," synthesized from the bus.
- **Real integrations:** swap simulated push for the Jira/Linear API, and
  paste-transcript for live transcription (Web Speech API → Deepgram/Recall).
