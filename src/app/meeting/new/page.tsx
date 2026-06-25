import { db, projects } from "@/lib/db";
import { createMeeting } from "@/lib/actions";
import { SAMPLE_TRANSCRIPT } from "@/lib/sample";

export const dynamic = "force-dynamic";

export default async function NewMeetingPage() {
  const allProjects = await db.select().from(projects);

  return (
    <div className="stack" style={{ gap: "1.25rem", maxWidth: 760, margin: "0 auto" }}>
      <div>
        <h1 className="h1">New meeting</h1>
        <p className="muted" style={{ margin: "0.35rem 0 0" }}>
          Paste a transcript. The lead agent extracts the tasks the team decided
          on, assigns owners by role, and hands you a draft to approve.
        </p>
      </div>

      <form action={createMeeting} className="card stack">
        <div>
          <label className="label">Project</label>
          <select
            name="projectId"
            className="select"
            defaultValue={allProjects[0]?.id ?? ""}
          >
            {allProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Meeting title</label>
          <input name="title" className="input" defaultValue="Sprint Planning" />
        </div>

        <div>
          <label className="label">Transcript</label>
          <textarea
            name="transcript"
            className="textarea"
            defaultValue={SAMPLE_TRANSCRIPT}
          />
        </div>

        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          <button type="submit" className="btn btn-primary">
            ⟁ Generate tasks
          </button>
          <span className="muted small">
            Uses GPT-4o-mini when <code>OPENAI_API_KEY</code> is set, else a free
            local heuristic.
          </span>
        </div>
      </form>
    </div>
  );
}
