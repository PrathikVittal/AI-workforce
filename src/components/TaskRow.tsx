"use client";

import { approveTask, deleteTask, updateTask } from "@/lib/actions";

interface MemberLite {
  id: string;
  name: string;
  role: string;
}

interface TaskRowData {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  estimate: string;
  status: "draft" | "approved" | "pushed";
  assigneeId: string | null;
}

export function TaskRow({
  task,
  members,
}: {
  task: TaskRowData;
  members: MemberLite[];
}) {
  const isDraft = task.status === "draft";

  return (
    <div className="card card-2">
      <div className="between" style={{ alignItems: "flex-start", gap: "1rem" }}>
        <div style={{ flex: 1 }}>
          <div className="row" style={{ gap: "0.5rem" }}>
            <span className={`badge badge-${task.priority}`}>{task.priority}</span>
            <strong>{task.title}</strong>
            {task.estimate ? (
              <span className="muted small">· {task.estimate}</span>
            ) : null}
          </div>
          {task.description ? (
            <p className="muted small" style={{ margin: "0.45rem 0 0" }}>
              {task.description}
            </p>
          ) : null}
        </div>
        <span className={`badge badge-${task.status}`}>{task.status}</span>
      </div>

      <hr className="divider" />

      <div
        className="row"
        style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}
      >
        <form action={updateTask} className="row" style={{ gap: "0.5rem" }}>
          <input type="hidden" name="taskId" value={task.id} />
          <select
            name="assigneeId"
            defaultValue={task.assigneeId ?? ""}
            disabled={!isDraft}
            className="select"
            style={{ width: "auto" }}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.role.toUpperCase()}
              </option>
            ))}
          </select>
          <select
            name="priority"
            defaultValue={task.priority}
            disabled={!isDraft}
            className="select"
            style={{ width: "auto" }}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </form>

        <div className="row" style={{ gap: "0.5rem" }}>
          {isDraft ? (
            <>
              <form action={deleteTask}>
                <input type="hidden" name="taskId" value={task.id} />
                <button className="btn btn-ghost btn-sm" type="submit">
                  Reject
                </button>
              </form>
              <form action={approveTask}>
                <input type="hidden" name="taskId" value={task.id} />
                <button className="btn btn-primary btn-sm" type="submit">
                  Approve →
                </button>
              </form>
            </>
          ) : (
            <span className="badge badge-approved">✓ approved</span>
          )}
        </div>
      </div>
    </div>
  );
}
