import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, meetings, members, tasks } from "@/lib/db";
import { TaskRow } from "@/components/TaskRow";
import { approveAllForMeeting } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id));
  if (!meeting) notFound();

  const [team, meetingTasks] = await Promise.all([
    db.select().from(members).where(eq(members.projectId, meeting.projectId)),
    db.select().from(tasks).where(eq(tasks.meetingId, id)).orderBy(asc(tasks.createdAt)),
  ]);

  const draftCount = meetingTasks.filter((t) => t.status === "draft").length;
  const memberLite = team.map((m) => ({ id: m.id, name: m.name, role: m.role }));

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <div>
        <Link href="/" className="muted small">
          ← Dashboard
        </Link>
        <div className="between" style={{ marginTop: "0.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 className="h1">{meeting.title}</h1>
            <p className="muted" style={{ margin: "0.35rem 0 0" }}>
              Lead agent drafted {meetingTasks.length} task
              {meetingTasks.length === 1 ? "" : "s"} · {draftCount} awaiting approval
            </p>
          </div>
          {draftCount > 0 ? (
            <form action={approveAllForMeeting}>
              <input type="hidden" name="meetingId" value={meeting.id} />
              <button type="submit" className="btn btn-primary">
                ✓ Approve all ({draftCount})
              </button>
            </form>
          ) : (
            <Link href="/board" className="btn">
              View board →
            </Link>
          )}
        </div>
      </div>

      {meetingTasks.length === 0 ? (
        <div className="card">
          <p className="muted">
            The agent didn&apos;t find any tasks in this transcript.
          </p>
        </div>
      ) : (
        <div className="stack">
          {meetingTasks.map((t) => (
            <TaskRow
              key={t.id}
              task={{
                id: t.id,
                title: t.title,
                description: t.description,
                priority: t.priority,
                estimate: t.estimate,
                status: t.status,
                assigneeId: t.assigneeId,
              }}
              members={memberLite}
            />
          ))}
        </div>
      )}

      <details className="card card-2">
        <summary style={{ cursor: "pointer" }} className="muted small">
          Show transcript
        </summary>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontFamily: "inherit",
            fontSize: "0.85rem",
            lineHeight: 1.6,
            margin: "0.85rem 0 0",
            color: "var(--muted)",
          }}
        >
          {meeting.transcript}
        </pre>
      </details>
    </div>
  );
}
