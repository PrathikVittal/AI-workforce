import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, meetings, members, projects, tasks } from "@/lib/db";
import { initials, ROLE_LABEL } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const allProjects = await db.select().from(projects);
  const project = allProjects[0];

  if (!project) {
    return (
      <div className="card">
        <h1 className="h1">No project yet</h1>
        <p className="muted">
          Run <code>npm run db:reset</code> to load the demo company.
        </p>
      </div>
    );
  }

  const [team, recentMeetings, allTasks] = await Promise.all([
    db.select().from(members).where(eq(members.projectId, project.id)),
    db
      .select()
      .from(meetings)
      .where(eq(meetings.projectId, project.id))
      .orderBy(desc(meetings.createdAt)),
    db.select().from(tasks).where(eq(tasks.projectId, project.id)),
  ]);

  const counts = {
    draft: allTasks.filter((t) => t.status === "draft").length,
    approved: allTasks.filter((t) => t.status === "approved").length,
    pushed: allTasks.filter((t) => t.status === "pushed").length,
  };
  const tasksByMeeting = (meetingId: string) =>
    allTasks.filter((t) => t.meetingId === meetingId).length;

  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      <div className="between" style={{ flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="h1">{project.name}</h1>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            {project.description}
          </p>
        </div>
        <div className="row">
          <Link href="/meeting/new" className="btn btn-primary">
            ⟁ New meeting
          </Link>
          <Link href="/board" className="btn">
            Board
          </Link>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <Stat label="Team" value={team.length} />
        <Stat label="Draft tasks" value={counts.draft} accent="amber" />
        <Stat label="Approved" value={counts.approved} accent="green" />
        <Stat label="Pushed" value={counts.pushed} accent="blue" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.1fr 1fr" }}>
        <div className="card">
          <div className="between">
            <h2 className="h2">Team</h2>
            <span className="muted small">{team.length} agents</span>
          </div>
          <hr className="divider" />
          <div className="stack" style={{ gap: "0.65rem" }}>
            {team.map((m) => (
              <div key={m.id} className="row" style={{ gap: "0.7rem" }}>
                <span className="avatar">{initials(m.name)}</span>
                <div style={{ flex: 1 }}>
                  <div>{m.name}</div>
                  <div className="muted small">{m.email}</div>
                </div>
                <span className={`badge badge-${m.role}`}>
                  {ROLE_LABEL[m.role] ?? m.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="between">
            <h2 className="h2">Meetings</h2>
            <Link href="/meeting/new" className="muted small">
              + new
            </Link>
          </div>
          <hr className="divider" />
          {recentMeetings.length === 0 ? (
            <p className="muted small">No meetings yet.</p>
          ) : (
            <div className="stack" style={{ gap: "0.5rem" }}>
              {recentMeetings.map((mt) => (
                <Link
                  key={mt.id}
                  href={`/review/${mt.id}`}
                  className="card card-2 between"
                  style={{ padding: "0.75rem 0.9rem" }}
                >
                  <div>
                    <div>{mt.title}</div>
                    <div className="muted small">
                      {new Date(mt.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <span className="badge">{tasksByMeeting(mt.id)} tasks</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "amber" | "green" | "blue";
}) {
  const color =
    accent === "amber"
      ? "var(--amber)"
      : accent === "green"
        ? "var(--green)"
        : accent === "blue"
          ? "#60a5fa"
          : "var(--text)";
  return (
    <div className="card">
      <div className="muted small">{label}</div>
      <div style={{ fontSize: "1.8rem", fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
