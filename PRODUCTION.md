# Scrum Agents — Production Roadmap

**Version:** 1.0
**Date:** June 11, 2026
**Status:** v1 mesh shipped (single-app simulation) · distributed production not yet started

---

## 0. How to use this document

This is the requirements map for taking Scrum Agents from the working v1 (a multi-agent
mesh simulated inside one web app) to a genuine production-grade **distributed AI workforce
OS** — an agent on every laptop, gossiping within team boundaries, acting as a personal
copilot, all under real RBAC.

It is organised in **three phases**, each a coherent milestone you could stop at:

| Phase | Goal | "Done when…" |
|---|---|---|
| **Phase 0 — Pilot** | One real team uses it daily | A single org runs real agents against real Jira/GitHub |
| **Phase 1 — Enterprise-ready** | You can *sell* it | SOC 2, SSO, multi-tenant, signed desktop agent |
| **Phase 2 — Scale** | Many orgs, reliably | Multi-region HA, full tool catalog, cost-optimised |

Section 7 is the **full requirements catalog** — every named tool, mapped to a phase, so
nothing is lost. Sections 8–9 are the honest cost and team realities.

---

## 1. Where we are today (v1)

| Layer | v1 (built) | Production target |
|---|---|---|
| App | Next.js 15 + TypeScript | same |
| DB | SQLite (libSQL) | managed PostgreSQL + pgvector |
| Agents | hand-rolled OpenAI calls (3 engines) | LangGraph runtime + CrewAI orchestration |
| Tools | direct Drizzle reads | MCP servers (Jira, GitHub, filesystem…) |
| Bus | `bus_events` table | NATS (JetStream) |
| Identity | "Acting as" cookie | real auth + SSO + multi-tenancy |
| RBAC | `rbac.ts` capability map | central, audited authz service |
| Runtime | one web app | desktop agent on every laptop |

The v1 logic maps forward cleanly — none of it is throwaway. This roadmap is about the
infrastructure, security, and distribution *around* that logic.

---

## 2. Target architecture (the four layers)

```
L4  MULTI-AGENT     reason together        CrewAI (+ AutoGen later)
L3  AGENT RUNTIME   the brain per laptop   LangGraph / Claude Agent SDK
L2  TOOLS           touch real systems     MCP servers
L1  TRANSPORT       laptops reach laptops  NATS + control plane (identity/RBAC)
```

---

## 3. Phase 0 — Pilot

*Goal: put real agents in front of one real team. Single-tenant is fine. Cut every
corner that isn't core to proving the loop works.*

### Data & backend
- [ ] Migrate SQLite → managed **PostgreSQL** (Neon / Supabase)
- [ ] Add **pgvector** for agent memory + RAG over code/docs
- [ ] **Redis** for caching + ephemeral agent state
- [ ] Background jobs (**Inngest**) for scheduled standups + velocity snapshots
- [ ] **S3** (or R2) for transcripts/artifacts

### Auth & access
- [ ] Replace the cookie switcher with real auth (**Better Auth** / Clerk)
- [ ] Promote `rbac.ts` to a server-enforced authorization check on every action

### Agents (L3 / L4)
- [ ] Wrap the 3 engines (extract / brief / standup) in a **LangGraph** runtime
- [ ] Stand up a **CrewAI** lead crew (lead delegates → sub-agents respond → synthesize)
- [ ] Prompt versioning (prompts as files, not inline strings)
- [ ] A small **eval set** (golden transcripts → expected tickets/standups)

### Tools (L2 / MCP)
- [ ] **Jira MCP server** (real ticket push, replacing the simulated push)
- [ ] **GitHub MCP server** (commits/PRs → real velocity signal)
- [ ] **Filesystem/git MCP server** (the copilot reads the working tree)

### Transport (L1)
- [ ] **NATS** (single node or Synadia free tier) with team-boundary subjects
- [ ] JetStream enabled so gossip/standups survive restarts

### Desktop agent
- [ ] **Tauri** shell wrapping the local agent (dev-signed; manual install OK for pilot)
- [ ] Local **code-execution sandbox** + permission prompts (shell/filesystem)
- [ ] OS keychain for local token storage

### Ops baseline
- [ ] Hosting: **Vercel** (web) + **Railway/Fly.io** (worker + NATS)
- [ ] **GitHub Actions** CI/CD (lint, test, build, release)
- [ ] **Sentry** error tracking
- [ ] **Langfuse** (or Helicone) — LLM tracing + per-call cost metering
- [ ] Secrets via **Doppler** (or env for now)
- [ ] Draft **Terms of Service + Privacy Policy**

---

## 4. Phase 1 — Enterprise-ready

*Goal: a company's security team will approve it and you can charge for it. This is the
expensive, unglamorous tier — and it is where most of the real work is.*

### Multi-tenancy & identity
- [ ] **Hard multi-tenant isolation** (Org A's agents never see Org B's data)
- [ ] **Enterprise SSO** (SAML/OIDC) + **SCIM** provisioning — via **WorkOS** / Auth0
- [ ] **Audit logging** — every agent action + data access, immutable, exportable

### Security & compliance (the gate to enterprise sales)
- [ ] **SOC 2 Type II** — engage an auditor; automate evidence with **Vanta** / Drata (6–12 mo)
- [ ] **Secrets management** — HashiCorp **Vault** / AWS Secrets Manager
- [ ] **Zero-data-retention / BAA agreement** with the LLM provider
- [ ] **PII + secret redaction** before anything reaches an LLM
- [ ] **Encryption** at rest + in transit, everywhere
- [ ] **Penetration test** (annual) + **Snyk**/Dependabot in CI
- [ ] **DPAs, EULA** — lawyer-reviewed
- [ ] **Cyber-liability insurance**
- [ ] **Incident response plan** + security contact

### Desktop distribution
- [ ] **Code-signing certificates** — Apple Developer + notarization, Windows EV cert
- [ ] **Auto-update** channel (Tauri updater / Sparkle)
- [ ] **MDM distribution** playbooks — Jamf, Microsoft Intune, Kandji
- [ ] Per-role **tool scoping** in MCP (which tools each role's agent may call)

### Agent quality
- [ ] **Guardrails** — output validation, jailbreak/PII filters
- [ ] **Continuous eval** in CI — catch prompt/model regressions
- [ ] **Model routing** + prompt caching for cost/latency

### Product & ops
- [ ] **Stripe** billing + license/seat management
- [ ] **Admin console** — org/member/role + agent configuration
- [ ] **Real-time UI** (WebSockets) for live bus + standups
- [ ] **Data pipelines** — ETL from Jira/GitHub for real velocity metrics
- [ ] Full observability — **Datadog** / Grafana + **OpenTelemetry**
- [ ] **Status page** + on-call (**PagerDuty**)
- [ ] **IaC** (**Terraform**) + container orchestration (**ECS**/K8s)
- [ ] Automated **backups** + documented disaster recovery

---

## 5. Phase 2 — Scale

*Goal: many orgs, high reliability, controlled cost.*

- [ ] **Multi-region** deployment + autoscaling + failover
- [ ] **NATS cluster** with JetStream HA
- [ ] **Kubernetes** for orchestration
- [ ] Full **MCP catalog** — Slack, Google Calendar, Confluence/Notion, GitLab, company DB
- [ ] **AutoGen** for richer free-form agent collaboration (if CrewAI proves limiting)
- [ ] **Vector DB at scale** — Pinecone / Weaviate
- [ ] **Cost optimisation** — batching, caching, cheaper-model routing, fine-tuning
- [ ] **Load + chaos testing** (it's a distributed system now)
- [ ] **Data residency** / regional deployments for EU/enterprise
- [ ] **CDN** + API gateway hardening + rate limiting / abuse prevention

---

## 6. Non-negotiables

Everything here reads source code and company data, so **security is the product**.
You cannot ship to a company without, at minimum:

- Real auth + **SSO**
- **Multi-tenant isolation**
- Airtight, audited **RBAC**
- **Secrets management** + encryption
- **SOC 2**
- **Audit logs**
- Local **execution sandbox** on the desktop agent
- **LLM observability** + cost controls

---

## 7. Full requirements catalog

Every named requirement, mapped to the phase it first lands in.

| Area | Requirement / Tool | Phase |
|---|---|---|
| **Desktop** | Tauri/Electron shell | 0 |
| | Code-execution sandbox + permission prompts | 0 |
| | OS keychain token storage | 0 |
| | Code-signing certs (Apple + Windows EV) | 1 |
| | Auto-update channel | 1 |
| | MDM distribution (Jamf/Intune/Kandji) | 1 |
| | Resource governor (CPU/RAM caps) | 1 |
| | Offline queue | 2 |
| **Agent brain** | OpenAI / Anthropic API | 0 |
| | LangGraph runtime | 0 |
| | CrewAI orchestration | 0 |
| | Prompt versioning | 0 |
| | Eval framework | 0→1 |
| | Guardrails (validation/PII) | 1 |
| | Model routing + prompt caching | 1 |
| | AutoGen (optional) | 2 |
| **Tools (MCP)** | Jira + GitHub + filesystem servers | 0 |
| | OAuth app registrations (Atlassian/GitHub/Google/Slack/MS) | 0→1 |
| | Per-role tool scoping | 1 |
| | Full catalog (Slack/Calendar/Notion/GitLab/DB) | 2 |
| **Transport** | NATS + JetStream (single node) | 0 |
| | Bus auth (JWT/creds) + TLS | 1 |
| | NATS cluster HA | 2 |
| **Backend** | Managed PostgreSQL | 0 |
| | pgvector / vector DB | 0→2 |
| | Redis | 0 |
| | Background jobs (Inngest/Temporal) | 0 |
| | Object storage (S3/R2) | 0 |
| **Auth** | Real auth (Better Auth/Clerk) | 0 |
| | Multi-tenant isolation | 1 |
| | SSO + SCIM (WorkOS/Auth0) | 1 |
| | Central RBAC service | 0→1 |
| | Audit logging | 1 |
| **Security** | Secrets manager (Vault/Doppler) | 0→1 |
| | SOC 2 Type II (Vanta/Drata) | 1 |
| | LLM zero-retention / BAA | 1 |
| | PII/secret redaction | 1 |
| | Encryption at rest + in transit | 1 |
| | Pen test + Snyk/Dependabot | 1 |
| | DPAs / ToS / Privacy / EULA | 0→1 |
| | Cyber-liability insurance | 1 |
| **Infra/DevOps** | Hosting (Vercel + Railway/Fly) | 0 |
| | CI/CD (GitHub Actions) | 0 |
| | IaC (Terraform) | 1 |
| | Orchestration (ECS/K8s) | 1→2 |
| | Multi-region / autoscaling / DR | 2 |
| | CDN + API gateway | 2 |
| **Observability** | Sentry | 0 |
| | LLM observability (Langfuse/Helicone) | 0 |
| | Logs/metrics/traces (Datadog + OTel) | 1 |
| | Status page + PagerDuty | 1 |
| **Product** | Admin console | 1 |
| | Real-time UI (WebSockets) | 1 |
| | Velocity data pipelines (ETL) | 1 |
| | Docs site + onboarding | 1 |
| **Business** | Legal entity + accounting | 1 |
| | Stripe billing/licensing | 1 |
| | Support/helpdesk | 1 |
| | Pricing model + MSAs | 1 |

---

## 8. Cost reality

The dominant recurring cost is **LLM inference**. An agent on every laptop — reasoning all
day and acting as a copilot — is large, continuous token volume. Budgeting, prompt caching,
and model routing are survival mechanisms, not optimisations. Other meaningful spend:
SOC 2 audit + tooling, managed infra (DB/Redis/NATS/hosting), code-signing certs, and the
LLM enterprise agreement.

**Defer-able for a first paying pilot:** multi-region HA, Kubernetes, fine-tuning, the full
MCP catalog (start with Jira + GitHub + filesystem), and AutoGen.

---

## 9. Team reality

This is honestly a **funded, multi-person effort**, not a solo build. The roles it implies:
backend, frontend, ML/agent engineering, DevOps/SRE, a security & compliance owner, design,
and a PM. The v1 you have is the right thing for one person to have built — it proves the
concept. Phase 1 is where it stops being a solo project.
