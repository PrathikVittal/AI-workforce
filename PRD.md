# Scrum Agents — Product Requirements Document

**Version:** 1.0  
**Date:** June 2, 2026  
**Status:** v1 shipped, v2 in design  

---

## 1. One-Line Definition

An AI agent org that lives inside your team — one agent per person, one lead agent per project — that listens to meetings, understands what's being built and by whom, generates and assigns tickets, and answers standup questions in real time.

---

## 2. The Problem

Software teams waste enormous time on meeting overhead: someone has to write up what was decided, translate decisions into tickets, figure out who owns what, fill in Jira, and then chase people at standup to find out if anything is actually progressing. In most organisations this falls on the PM or Scrum Master, and most of it is mechanical.

At the same time, the tools that exist today (Otter.ai, Fireflies, Notion AI) are passive — they summarise a meeting but don't act on it. A PM still has to read the summary, manually create tickets, manually assign them, and manually track progress. Nothing is wired together.

**The gap:** there is no system that understands the org, lives in the meeting, produces ready-to-approve work items, and then keeps watching what is actually happening between meetings.

---

## 3. Product Vision

Scrum Agents is not a meeting summariser. It is a distributed AI workforce layer — one agent per person in a software team, all of them connected, each with a role-matched level of authority and access.

### How it works, in the user's own words

> "There will be an agent included in the meeting who has access to the company database of that particular project — who all are in the team, which developers are working on which problem, which development and everything. When the meeting is done, the agent revises a plan of what was discussed to build and create a list to assign all of these tasks... the project manager or the scrum master can approve with just a click of a button and all of this will go to the task dashboard and get updated to specific developers on what task they are building."

> "The agent will know what the project is, say everyone in the meeting and the PM asks for a standup to the agent — the agent will briefly explain what was achieved last week, what was pending from last week, what was done till this moment, what is missing, and what is the timeline for achieving the whole project at this rate."

> "The company will install the agent in every laptop so the agent will have a role in that company laptop same as the person using the laptop. The PM will have a role as PM, the SDE2 will have SDE2, and each role will have different authorisations. The agent will keep an eye on what work is being done and will communicate with that team's agents — meaning other computers whose users are in the same team."

### What that means architecturally

Every human on a project team has a **sub-agent** with the same role and permissions as themselves. A PM's agent sees the whole project. An SDE2's agent sees only what an SDE2 is authorised to see. A QA's agent is scoped to testing and quality work. These agents live on each person's machine and continuously observe what their human owner is doing.

Above all of them sits a **lead agent** — the acting Scrum Master, carrying the authority of the highest role on the team. The lead agent is the one in the meeting. After the meeting it briefs every sub-agent on what was decided. Between meetings the sub-agents gossip with each other: they share lightweight signals about what their owners are actually working on. The lead agent synthesises these signals to answer standup questions, surface blockers, and track velocity against the project timeline.

The output is not Jira-specific. It targets whatever task management tool the organisation uses — Jira, Linear, Trello, Notion, GitHub Issues. The integration layer is pluggable.

---

## 4. Users and Roles

| Role | Who they are | What they can do |
|---|---|---|
| **PM** | Project manager, highest authority | Approve/reject tasks, push to task tool, request standup, view all data |
| **TL** | Tech lead | Approve/reject tasks (within their domain), view all team data |
| **SDE2** | Senior software developer | View and update own tasks, view team workload |
| **SDE1** | Junior software developer | View and update own tasks |
| **QA** | Quality assurance engineer | View all tasks, flag quality concerns |
| **Admin** | System administrator | Manage projects, members, and agent configuration |

Each role maps exactly to an agent persona. An SDE2 on the team has an SDE2 sub-agent. The agent inherits the same permissions the human has, neither more nor less.

---

## 5. Core User Flows

### Flow 1 — Meeting → Tasks → Board

1. The team has a project meeting. Everyone is talking about what to build, how to approach it, what is blocked, and what is due.
2. The lead agent is present in the meeting (listening via the installed agent, a browser session, or a meeting bot integration).
3. The lead agent listens to the full conversation, cross-references its knowledge of the team (who is in the project, what each developer is currently assigned to, current sprint state, open tickets), and forms a plan.
4. After the meeting ends, the lead agent produces a set of **draft tasks** — each with a title, description, suggested assignee, priority, and effort estimate.
5. The PM (or Tech Lead) opens the **Review screen**. They can see each draft task, edit the assignee or priority if needed, reject tasks that are not relevant, or click **Approve all** to accept everything in one click.
6. Approved tasks are pushed to the team's task management tool (Jira, Linear, etc.). Developers open their boards and their assignments are already there.

### Flow 2 — Standup request

1. During or before a standup meeting, the PM says to the lead agent: "Give me a standup."
2. The lead agent queries the team bus — the collective signal from all sub-agents about what each developer has actually been working on, what PRs were merged, what tickets moved, what has been stuck.
3. The lead agent produces a standup summary covering:
   - What was achieved since the last meeting
   - What was planned but not completed (and why, if known)
   - What each developer is currently working on
   - Active blockers and dependencies
   - Projected completion date for the current sprint / overall project at the current velocity
4. This is delivered in natural language, directly in the meeting.

### Flow 3 — Sub-agent gossip (background, continuous)

1. John (SDE2) is working on the Stripe webhook handler. His sub-agent (also SDE2-scoped) observes what he is actively doing — files he is editing, commits he is making, tickets he is moving.
2. John's sub-agent emits lightweight status signals to the team bus: what is in progress, what is blocked, how long tasks are taking.
3. The lead agent reads these signals continuously. When the PM asks for a standup, the lead agent already has a current picture — it doesn't have to wait and ask each person.
4. No sub-agent can see another person's private work. Signals are role-scoped — a QA agent cannot read an SDE2's code; it can only read public status.

---

## 6. Feature Breakdown

### Phase 1 — Core Pipeline (BUILT)

**Status: Complete as of June 2, 2026**

The heart of the product. Proves the meeting-to-board pipeline works end to end.

| Feature | Description | Status |
|---|---|---|
| Project & team seeding | A project has a name, description, and a team of members each with a role | ✅ Done |
| Meeting transcript input | PM pastes or uploads a transcript into the web app | ✅ Done |
| Lead agent task extraction | LLM reads the transcript + team roster and outputs structured draft tasks with assignee, priority, and estimate | ✅ Done |
| Free fallback extractor | When no OpenAI key is available, a deterministic heuristic extractor extracts action items and distributes them by role — the full pipeline works for $0 | ✅ Done |
| PM review screen | Per-task editable view: change assignee, change priority, reject, or approve individually | ✅ Done |
| Approve all | One button approves all remaining draft tasks for a meeting | ✅ Done |
| Team board | Approved tasks displayed by owner, grouped into developer columns | ✅ Done |
| Simulated push | "Push to Jira" flips task status to `pushed` — demonstrates the pipeline end to end; real adapter slots in here | ✅ Done |
| Demo company seed | `npm run db:reset` seeds a 6-person project team with a pre-processed meeting and 8 draft tasks | ✅ Done |

**Pages built:**

| Route | Purpose |
|---|---|
| `/` | Dashboard: project overview, team roster, recent meetings, task stat counters |
| `/meeting/new` | New meeting: paste a transcript, select a project, submit to generate draft tasks |
| `/review/[id]` | Review screen: inspect, edit, and approve/reject tasks from a specific meeting |
| `/board` | Team board: approved and pushed tasks grouped by assignee with a push action |

---

### Phase 2 — The Agent Mesh (NEXT)

Turns the simulated org into a real agent org. Each team member gets a role-scoped sub-agent persona with its own permissions, memory, and the ability to report status.

| Feature | Description |
|---|---|
| Sub-agent personas | Each `members` row becomes a live sub-agent: a role, a permission set (RBAC), and its own memory context |
| Role-based access control | PM agent sees everything; TL sees team-wide data; SDE agents see only their own work and team workload; QA sees quality-relevant signals |
| Auth + login | Each human logs in; their session determines which agent persona is active |
| Team bus | A shared `team_bus` table where sub-agents post lightweight status signals: `{agent_id, type, payload, created_at}` |
| Lead agent briefing | After a meeting, the lead agent posts a briefing to the bus that each sub-agent reads and acknowledges |
| Sub-agent status reporting | A sub-agent can emit signals when its human owner moves a ticket, makes a commit, or marks work done |
| Simulated multi-laptop demo | Multiple browser tabs / logins simulate separate "machines" without real network distribution |

---

### Phase 3 — Standup Intelligence (NEXT)

The lead agent answers standup questions from the accumulated team bus.

| Feature | Description |
|---|---|
| Standup endpoint | PM can type "standup" or click a button; lead agent synthesises bus signals into a structured standup |
| Velocity tracking | Lead agent tracks ticket throughput over time — how much gets done per sprint — and uses it to project completion |
| Blocker detection | Tasks that have been `in_progress` for too long with no movement are surfaced as blockers |
| Timeline projection | "At this rate, the project completes in approximately X weeks" — calculated from current velocity vs remaining work |
| Historical context | Past meeting transcripts, briefings, and bus signals are stored and searchable via vector search for richer context |

---

### Phase 4 — Real Integrations (LATER)

Replacing simulated pieces with production-grade integrations.

| Feature | Description |
|---|---|
| Jira REST API adapter | `pushTask` in `src/lib/actions.ts` replaced with real Jira v3 API calls: create issue, set assignee, sprint, story points |
| Linear / Trello / GitHub Issues adapters | Same interface, different backend — org picks their tool |
| Live transcription | Web Speech API (browser-native, free) → Deepgram for production (real-time STT + speaker diarization) |
| Meeting bot (future) | Recall.ai or similar — joins Zoom/Meet/Teams as a participant without anyone sharing a tab |
| Desktop agent (future) | Electron or Tauri wrapper so the agent can observe the human's actual work (git activity, file changes) without requiring a browser |
| GitHub / GitLab integration | Pull commit and PR data per developer to feed the team bus automatically |

---

## 7. Technical Architecture

### Current architecture (v1)

```
Browser (Next.js 15)
    │
    │  Server Actions (HTTP POST)
    ▼
API Layer  src/lib/actions.ts
    │
    ├── Drizzle ORM
    │       └── libSQL client → scrum.db (SQLite file)
    │
    └── Lead Agent  src/lib/llm/extract.ts
            ├── OpenAI gpt-4o-mini  (if OPENAI_API_KEY is set)
            └── Deterministic heuristic fallback  (free, always works)
```

### Target architecture (v2+)

```
Browser tabs / desktop clients
    │  (each tab = one team member = one agent persona)
    │
    │  Server Actions + WebSocket (for real-time bus)
    ▼
API Layer
    │
    ├── Auth layer (Better Auth)
    │       └── Role JWT → determines active agent persona
    │
    ├── Drizzle ORM → PostgreSQL (Neon) [replacing SQLite at scale]
    │       ├── projects, members, meetings, tasks
    │       ├── team_bus  (agent gossip signals)
    │       └── agent_memory  (per-agent vector embeddings, future)
    │
    ├── Lead Agent
    │       ├── Meeting extractor (transcript → tasks)
    │       └── Standup synthesiser (team_bus → natural language)
    │
    └── Sub-agents (one per member, instanced per request)
            ├── Role-scoped data access
            └── Status signal emitter → team_bus
```

### Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 15 + React 19 + TypeScript | App router, server actions |
| Styling | Tailwind v4 | Custom dark theme, no component library dependency |
| ORM | Drizzle ORM | Type-safe, migration-native |
| Database | libSQL / SQLite (v1) → Neon PostgreSQL (v2+) | Zero-setup locally, scales to cloud |
| LLM | OpenAI gpt-4o-mini | Optional; heuristic fallback when no key |
| Auth | Better Auth (v2) | Role-aware sessions, JWT |
| Background jobs | Inngest (v2+) | Post-meeting processing, bus snapshots |
| Real-time | WebSockets or Inngest realtime (v2+) | Agent bus live updates |
| Transcription | Web Speech API (v3 free) → Deepgram (v3 prod) | Speaker diarization in prod |
| Meeting bot | Recall.ai (v4) | Joins Zoom/Meet/Teams without screen share |
| Desktop agent | Tauri (v4) | Lightweight, observes local file/git activity |
| Task integrations | Jira REST API v3 (v4) | Pluggable — Linear/GitHub Issues same interface |

---

## 8. Database Schema

### Current (v1 — SQLite)

```
projects
  id            text PK
  name          text
  description   text
  status        text  (active | archived)
  created_at    text

members
  id            text PK
  project_id    text FK → projects
  name          text
  email         text
  role          text  (pm | tl | sde2 | sde1 | qa)
  created_at    text

meetings
  id            text PK
  project_id    text FK → projects
  title         text
  transcript    text
  status        text  (processed | empty)
  created_at    text

tasks
  id            text PK
  meeting_id    text FK → meetings (nullable)
  project_id    text FK → projects
  title         text
  description   text
  assignee_id   text FK → members (nullable)
  priority      text  (low | medium | high)
  estimate      text
  status        text  (draft | approved | pushed)
  created_at    text
```

### Additions planned for v2+

```
team_bus
  id            text PK
  agent_id      text FK → members
  type          text  (status_update | blocker | work_started | work_done | briefing)
  payload       json
  visible_to    text  (all | same_team | pm_only)
  created_at    text

agent_memory
  id            text PK
  agent_id      text FK → members
  content       text
  embedding     vector(1536)   -- pgvector
  created_at    text

sessions
  (managed by Better Auth)
```

---

## 9. Non-Goals

These are explicitly out of scope for the current build phase and will be revisited after the agent mesh is proven:

- **Building a video conferencing product.** The agent joins existing meetings (Zoom, Meet, Teams) — it does not replace them.
- **Real-time voice recognition in v1.** Transcripts are pasted. Live speech is a v3 integration.
- **A mobile app.** Web-first. Responsive enough to be usable on mobile but not a native app.
- **Cross-organisation/multi-tenant in v1/v2.** Single org, single project space. Multi-tenant architecture comes after the core is solid.
- **Replacing human judgement.** The PM still approves every task. The lead agent proposes; humans decide. The "Approve all" button is a convenience, not automation without oversight.

---

## 10. Constraints

| Constraint | Detail |
|---|---|
| Solo developer | Every feature decision is balanced against implementation time for one person |
| Zero operating cost target | v1 and v2 must run for free locally. Paid services (OpenAI, Neon, Deepgram) are opt-in upgrades, not requirements |
| No existing job/income | No paid APIs, SaaS seats, or infrastructure costs until the product can justify them |
| Web-first | No desktop app install required until v4. Everything runs in the browser |
| No real meeting bot in v1/v2 | Transcript is pasted, not captured live — removes Recall.ai dependency entirely for early phases |

---

## 11. Roadmap

| Phase | What ships | What it proves |
|---|---|---|
| **v1 — Core Pipeline** ✅ | Transcript → lead agent → draft tasks → PM approval → board | The full pipeline works. The lead agent produces useful, role-assigned tasks. |
| **v2 — Agent Mesh** | Per-member sub-agents with RBAC, team bus, lead agent briefing, standup synthesis | "This is not a meeting summariser — it is an agent org." |
| **v3 — Live Transcription** | Web Speech API (free) → Deepgram (prod), real-time transcript feed, live task extraction | Removes the "paste transcript" step. The agent actually listens. |
| **v4 — Real Integrations** | Jira/Linear push, meeting bot (Recall.ai), desktop agent (Tauri), GitHub activity feed | Production-grade. A real team could run this at work. |

---

## 12. Success Metrics (v1 → v2)

| Metric | v1 baseline | v2 target |
|---|---|---|
| Tasks extracted per meeting | 8 (from demo seed) | 6–12 (real meeting typical) |
| PM time to approve all tasks | Manual per-task → < 10 seconds with Approve All | < 5 seconds |
| Task assignment accuracy (right person) | ~70% heuristic / ~90% with GPT | >85% without GPT key |
| Standup prep time | N/A (v1 doesn't have standup) | < 30 seconds to generate |
| Cost to run (solo dev, local) | $0 | $0 |

---

## 13. Open Questions

1. **Agent observation scope:** In v4, when the desktop agent observes a developer's machine, what exactly does it read? (git status, open files, Jira ticket state?) What does it never read? (private messages, browser history.) This needs a clear policy before v4.
2. **Task tool adapter interface:** Should the push interface be a standard schema (one interface, multiple adapters) or should each integration be bespoke? A shared interface is cleaner but limits what each tool can express.
3. **Standup delivery format:** Does the lead agent deliver the standup as text on screen, as a voice response, or both? Voice delivery makes it feel much more like a real presence in the meeting.
4. **RBAC enforcement on the team bus:** Sub-agents post signals to the bus. What happens if an agent attempts to read a signal outside its permission scope? Should mismatches be silently filtered or explicitly rejected (and logged)?
5. **Multi-project support:** A developer is often on multiple projects. Does each project get its own isolated agent instance, or does one agent manage context across all projects for one person?
