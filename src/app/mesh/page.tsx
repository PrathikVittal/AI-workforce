import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import {
  db,
  agents,
  busEvents,
  members,
  projects,
  tasks,
  type BusKind,
} from "@/lib/db";
import { getCurrentMember } from "@/lib/identity";
import { can, isLead, rank } from "@/lib/rbac";
import { runStandup } from "@/lib/actions";
import { initials, ROLE_LABEL } from "@/lib/ui";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<BusKind, string> = {
  briefing: "📋 briefing",
  progress: "✅ progress",
  blocker: "⛔ blocker",
  standup: "📣 standup",
  note: "📝 note",
};

export default async function MeshPage() {
  const [project] = await db.select().from(projects);
  if (!project) {
    return (
      <div className="card">
        <p className="muted">
          No project yet. Run <code>npm run db:reset</code> to load the demo
          company.
        </p>
      </div>
    );
  }

  const viewer = await getCurrentMember();
  const viewerIsLead = viewer ? isLead(viewer.role) : false;

  const [team, agentRows, taskRows, events] = await Promise.all([
    db.select().from(members).where(eq(members.projectId, project.id)),
    db.select().from(agents).where(eq(agents.projectId, project.id)),
    db.select().from(tasks).where(eq(tasks.projectId, project.id)),
    db
      .select()
      .from(busEvents)
      .where(eq(busEvents.projectId, project.id))
      .orderBy(desc(busEvents.createdAt))
      .limit(40),
  ]);

  const memberById = new Map(team.map((m) => [m.id, m]));
  const ownerOfAgent = (agentId: string | null) => {
    if (!agentId) return null;
    const a = agentRows.find((x) => x.id === agentId);
    return a ? (memberById.get(a.memberId) ?? null) : null;
  };
  const taskTitle = (taskId: string | null) =>
    taskId ? (taskRows.find((t) => t.id === taskId)?.title ?? null) : null;

  // RBAC read-scope: only leads see "leads"-audience chatter.
  const visibleEvents = events.filter(
    (e) => e.audience === "team" || viewerIsLead,
  );
  const feed = visibleEvents.filter((e) => e.kind !== "standup");
  const latestStandup = visibleEvents.find((e) => e.kind === "standup") ?? null;

  // Agents sorted by seniority; the lead is the most senior.
  const roster = [...agentRows].sort((a, b) => rank(a.role) - rank(b.role));
  const leadAgentId = roster[0]?.id;

  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      <div className="between" style={{ flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="h1">Agent Mesh</h1>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            One agent per teammate. The lead agent briefs the others after a
            meeting; they gossip about their owner&apos;s work on the bus.
          </p>
        </div>
        {viewer && can(viewer.role, "runStandup") ? (
          <form action={runStandup}>
            <input type="hidden" name="projectId" value={project.id} />
            <button type="submit" className="btn btn-primary">
              📣 Run standup
            </button>
          </form>
        ) : null}
      </div>

      {latestStandup ? (
        <div className="card">
          <div className="between">
            <h2 className="h2">Latest standup</h2>
            <span className="muted small">
              {new Date(latestStandup.createdAt).toLocaleString()}
            </span>
          </div>
          <hr className="divider" />
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontFamily: "inherit",
              fontSize: "0.9rem",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {latestStandup.content}
          </pre>
        </div>
      ) : viewerIsLead ? (
        <div className="card card-2">
          <p className="muted small" style={{ margin: 0 }}>
            No standup yet. Hit <strong>Run standup</strong> and the lead agent
            will synthesize where the team stands.
          </p>
        </div>
      ) : null}

      <div className="grid" style={{ gridTemplateColumns: "1fr 1.1fr" }}>
        {/* Agents */}
        <div className="card">
          <div className="between">
            <h2 className="h2">Agents</h2>
            <span className="muted small">{roster.length}</span>
          </div>
          <hr className="divider" />
          <div className="stack" style={{ gap: "0.9rem" }}>
            {roster.map((a) => {
              const owner = memberById.get(a.memberId);
              if (!owner) return null;
              const you = viewer?.id === owner.id;
              return (
                <div key={a.id} className="card card-2" style={{ padding: "0.85rem" }}>
                  <div className="row" style={{ gap: "0.6rem" }}>
                    <span className="avatar">{initials(owner.name)}</span>
                    <div style={{ flex: 1 }}>
                      <div className="row" style={{ gap: "0.4rem" }}>
                        <strong>{owner.name}</strong>
                        {you ? <span className="muted small">(you)</span> : null}
                      </div>
                      <div className="muted small">{owner.email}</div>
                    </div>
                    <div className="stack" style={{ gap: "0.3rem", alignItems: "flex-end" }}>
                      <span className={`badge badge-${a.role}`}>
                        {ROLE_LABEL[a.role] ?? a.role}
                      </span>
                      {a.id === leadAgentId ? (
                        <span className="muted small">lead agent</span>
                      ) : null}
                    </div>
                  </div>
                  <div
                    className="muted small"
                    style={{
                      marginTop: "0.6rem",
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.5,
                    }}
                  >
                    {a.memory ? a.memory : "No memory yet — hasn't been briefed."}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gossip feed */}
        <div className="card">
          <div className="between">
            <h2 className="h2">Bus</h2>
            <span className="muted small">{feed.length} events</span>
          </div>
          <hr className="divider" />
          {feed.length === 0 ? (
            <p className="muted small">
              No chatter yet. Approve a meeting&apos;s tasks to trigger briefings,
              or move a task on the <Link href="/board">board</Link>.
            </p>
          ) : (
            <div className="stack" style={{ gap: "0.7rem" }}>
              {feed.map((e) => {
                const from = ownerOfAgent(e.fromAgentId);
                const to = ownerOfAgent(e.toAgentId);
                const rel = taskTitle(e.relatedTaskId);
                return (
                  <div key={e.id} className="card card-2" style={{ padding: "0.7rem 0.8rem" }}>
                    <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                      <span className="badge">{KIND_LABEL[e.kind]}</span>
                      <span className="small">
                        <strong>{from?.name ?? "Agent"}</strong>
                        {to ? <span className="muted"> → {to.name}</span> : null}
                      </span>
                    </div>
                    <p className="small" style={{ margin: "0.45rem 0 0", lineHeight: 1.5 }}>
                      {e.content}
                    </p>
                    <div className="muted small" style={{ marginTop: "0.4rem" }}>
                      {rel ? `re: ${rel} · ` : ""}
                      {new Date(e.createdAt).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
