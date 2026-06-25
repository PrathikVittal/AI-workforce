import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { agents, busEvents, meetings, members, projects, tasks } from "./schema";
import { extractTasks } from "../llm/extract";
import { briefTasks } from "../mesh";
import { SAMPLE_TRANSCRIPT } from "../sample";
import type { WorkStatus } from "./schema";

async function main() {
  // Reset (FK-safe order: bus refs agents+tasks; agents ref members; etc.)
  await db.delete(busEvents);
  await db.delete(tasks);
  await db.delete(agents);
  await db.delete(meetings);
  await db.delete(members);
  await db.delete(projects);

  const [project] = await db
    .insert(projects)
    .values({
      name: "Orbit — Customer Portal",
      description:
        "A self-serve customer portal: authentication, Stripe billing, and a usage dashboard.",
      status: "active",
    })
    .returning();

  const team = await db
    .insert(members)
    .values([
      { projectId: project.id, name: "Priya Nair", email: "priya@orbit.dev", role: "pm" },
      { projectId: project.id, name: "Marcus Lee", email: "marcus@orbit.dev", role: "tl" },
      { projectId: project.id, name: "Aisha Khan", email: "aisha@orbit.dev", role: "sde2" },
      { projectId: project.id, name: "Diego Santos", email: "diego@orbit.dev", role: "sde2" },
      { projectId: project.id, name: "Tom Becker", email: "tom@orbit.dev", role: "sde1" },
      { projectId: project.id, name: "Lena Ortiz", email: "lena@orbit.dev", role: "qa" },
    ])
    .returning();

  // One agent per teammate — the agent's role mirrors its owner's.
  const agentRows = await db
    .insert(agents)
    .values(
      team.map((m) => ({
        projectId: project.id,
        memberId: m.id,
        role: m.role,
      })),
    )
    .returning();
  const agentByMember = new Map(agentRows.map((a) => [a.memberId, a]));

  const [meeting] = await db
    .insert(meetings)
    .values({
      projectId: project.id,
      title: "Sprint 7 Planning",
      transcript: SAMPLE_TRANSCRIPT,
    })
    .returning();

  const drafts = await extractTasks({
    transcript: SAMPLE_TRANSCRIPT,
    projectName: project.name,
    roster: team.map((m) => ({ id: m.id, name: m.name, role: m.role })),
  });

  const inserted = drafts.length
    ? await db
        .insert(tasks)
        .values(
          drafts.map((d) => ({
            meetingId: meeting.id,
            projectId: project.id,
            title: d.title,
            description: d.description,
            assigneeId: team.find((m) => m.name === d.assigneeName)?.id ?? null,
            priority: d.priority,
            estimate: d.estimate,
          })),
        )
        .returning()
    : [];

  // Approve a few *assigned* tasks so the board and mesh have real work.
  const assigned = inserted.filter((t) => t.assigneeId);
  const toApprove = assigned.slice(0, 3);
  for (const t of toApprove) {
    await db.update(tasks).set({ status: "approved" }).where(eq(tasks.id, t.id));
  }

  // Lead agent briefs the assignees (creates briefing events + agent memory).
  await briefTasks(toApprove.map((t) => t.id));

  // Give the approved work a spread of work statuses + matching gossip, so
  // standup has something real to synthesize on first load.
  const flow: WorkStatus[] = ["done", "in_progress", "blocked"];
  const gossip: Record<WorkStatus, (name: string, title: string) => string> = {
    done: (n, t) => `${n} finished "${t}" and opened a PR for review.`,
    in_progress: (n, t) => `${n} started "${t}" this morning.`,
    blocked: (n, t) => `${n} is blocked on "${t}" — waiting on the auth service spec.`,
    todo: (n, t) => `${n} queued "${t}".`,
  };

  const now = Date.now();
  for (let i = 0; i < toApprove.length; i++) {
    const t = toApprove[i];
    const ws = flow[i % flow.length];
    const owner = team.find((m) => m.id === t.assigneeId);
    const agent = t.assigneeId ? agentByMember.get(t.assigneeId) : undefined;
    await db.update(tasks).set({ workStatus: ws }).where(eq(tasks.id, t.id));
    if (owner && agent) {
      await db.insert(busEvents).values({
        projectId: project.id,
        fromAgentId: agent.id,
        kind: ws === "blocked" ? "blocker" : "progress",
        content: gossip[ws](owner.name, t.title),
        relatedTaskId: t.id,
        audience: "team",
        // stagger timestamps so the feed reads in a sensible order
        createdAt: new Date(now + i * 1000).toISOString(),
      });
    }
  }

  const eventCount = await db.select().from(busEvents);
  console.log(
    `✓ seeded "${project.name}" — ${team.length} members + agents, ` +
      `${inserted.length} tasks, ${eventCount.length} bus events`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
