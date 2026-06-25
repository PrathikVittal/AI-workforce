import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, members, projects, tasks, type Task } from "@/lib/db";
import { pushAllApproved, pushTask } from "@/lib/actions";
import { WorkStatusControl } from "@/components/WorkStatusControl";
import { initials, ROLE_LABEL } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const [project] = await db.select().from(projects);
  if (!project) {
    return (
      <div className="card">
        <p className="muted">
          No project. Run <code>npm run db:reset</code>.
        </p>
      </div>
    );
  }

  const [team, allTasks] = await Promise.all([
    db.select().from(members).where(eq(members.projectId, project.id)),
    db.select().from(tasks).where(eq(tasks.projectId, project.id)),
  ]);

  // Only approved/pushed work reaches the board; drafts live in review.
  const visible = allTasks.filter((t) => t.status !== "draft");
  const approvedCount = visible.filter((t) => t.status === "approved").length;

  const columns = team
    .map((m) => ({ member: m, items: visible.filter((t) => t.assigneeId === m.id) }))
    .filter((c) => c.items.length > 0);
  const unassigned = visible.filter((t) => !t.assigneeId);

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <div className="between" style={{ flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="h1">Board</h1>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            Approved work, by owner. Pushing is simulated — a real Jira/Linear
            adapter slots in here later.
          </p>
        </div>
        {approvedCount > 0 ? (
          <form action={pushAllApproved}>
            <input type="hidden" name="projectId" value={project.id} />
            <button className="btn btn-primary" type="submit">
              ↗ Push all approved ({approvedCount})
            </button>
          </form>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="card">
          <p className="muted">
            Nothing approved yet. Open a meeting from the{" "}
            <Link href="/">dashboard</Link>, approve its tasks, and they land
            here.
          </p>
        </div>
      ) : (
        <div
          className="grid"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(258px, 1fr))",
            alignItems: "start",
          }}
        >
          {columns.map(({ member, items }) => (
            <Column
              key={member.id}
              title={member.name}
              subtitle={ROLE_LABEL[member.role] ?? member.role}
              avatar={initials(member.name)}
              items={items}
            />
          ))}
          {unassigned.length > 0 ? (
            <Column title="Unassigned" subtitle="no owner" items={unassigned} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function Column({
  title,
  subtitle,
  items,
  avatar,
}: {
  title: string;
  subtitle: string;
  items: Task[];
  avatar?: string;
}) {
  return (
    <div className="card">
      <div className="row" style={{ gap: "0.6rem" }}>
        {avatar ? <span className="avatar">{avatar}</span> : null}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{title}</div>
          <div className="muted small">{subtitle}</div>
        </div>
        <span className="badge">{items.length}</span>
      </div>
      <hr className="divider" />
      <div className="stack" style={{ gap: "0.6rem" }}>
        {items.map((t) => (
          <div key={t.id} className="card card-2" style={{ padding: "0.7rem 0.8rem" }}>
            <div className="row" style={{ gap: "0.4rem", marginBottom: "0.35rem" }}>
              <span className={`badge badge-${t.priority}`}>{t.priority}</span>
              {t.estimate ? <span className="muted small">{t.estimate}</span> : null}
            </div>
            <div style={{ fontSize: "0.9rem" }}>{t.title}</div>
            <div className="between" style={{ marginTop: "0.55rem", gap: "0.5rem" }}>
              <WorkStatusControl taskId={t.id} value={t.workStatus} />
              {t.status === "approved" ? (
                <form action={pushTask}>
                  <input type="hidden" name="taskId" value={t.id} />
                  <button className="btn btn-sm" type="submit">
                    ↗ Push
                  </button>
                </form>
              ) : (
                <span className="badge badge-pushed">
                  ↗ JIRA-{t.id.slice(0, 4).toUpperCase()}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
