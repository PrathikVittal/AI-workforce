import OpenAI from "openai";
import { desc, eq } from "drizzle-orm";
import { db, busEvents, members, tasks, type WorkStatus } from "./db";

/**
 * The standup synthesis — the payoff of the mesh.
 *
 * The lead agent reads the committed work (approved/pushed tasks), their work
 * status, and recent bus chatter, then produces a concise standup: what's
 * done, in progress, blocked, and up next, plus a rough outlook. LLM-written
 * when a key is set, deterministic template otherwise.
 */

interface StandupData {
  projectName: string;
  counts: Record<WorkStatus, number>;
  committed: number;
  byStatus: Record<WorkStatus, { title: string; owner: string }[]>;
  blockers: string[];
}

export async function generateStandup(
  projectId: string,
  projectName: string,
): Promise<string> {
  const data = await gather(projectId, projectName);
  if (data.committed === 0) {
    return "No committed work yet. Approve some tasks from a meeting and they'll show up here.";
  }
  if (process.env.OPENAI_API_KEY) {
    try {
      return await llmStandup(data);
    } catch (err) {
      console.error("[standup] LLM failed, using template:", err);
    }
  }
  return templateStandup(data);
}

async function gather(
  projectId: string,
  projectName: string,
): Promise<StandupData> {
  const [taskRows, team, recentBus] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.projectId, projectId)),
    db.select().from(members).where(eq(members.projectId, projectId)),
    db
      .select()
      .from(busEvents)
      .where(eq(busEvents.projectId, projectId))
      .orderBy(desc(busEvents.createdAt))
      .limit(12),
  ]);

  const nameById = new Map(team.map((m) => [m.id, m.name]));
  // Only committed work counts toward standup — drafts aren't real yet.
  const committedTasks = taskRows.filter((t) => t.status !== "draft");

  const counts: Record<WorkStatus, number> = {
    todo: 0,
    in_progress: 0,
    blocked: 0,
    done: 0,
  };
  const byStatus: StandupData["byStatus"] = {
    todo: [],
    in_progress: [],
    blocked: [],
    done: [],
  };
  for (const t of committedTasks) {
    counts[t.workStatus]++;
    byStatus[t.workStatus].push({
      title: t.title,
      owner: t.assigneeId ? (nameById.get(t.assigneeId) ?? "unassigned") : "unassigned",
    });
  }

  const blockers = recentBus
    .filter((e) => e.kind === "blocker")
    .map((e) => e.content);

  return {
    projectName,
    counts,
    committed: committedTasks.length,
    byStatus,
    blockers,
  };
}

function outlook(data: StandupData): string {
  const { counts, committed } = data;
  const remaining = committed - counts.done;
  if (counts.done === 0) {
    return `Outlook: nothing finished yet, so no reliable projection — ${remaining} task(s) of ${committed} still open.`;
  }
  const cycles = Math.ceil(remaining / counts.done);
  const pace = `${counts.done} of ${committed} done`;
  if (remaining === 0) return `Outlook: all ${committed} committed tasks are done. 🎉`;
  return `Outlook: at the current pace (${pace}), roughly ${cycles} more cycle(s) of work remain${
    counts.blocked > 0 ? `, but ${counts.blocked} blocked item(s) put that at risk` : ""
  }.`;
}

function templateStandup(data: StandupData): string {
  const { counts, byStatus, blockers } = data;
  const line = (items: { title: string; owner: string }[]) =>
    items.length
      ? items.map((i) => `   • ${i.title} (${i.owner})`).join("\n")
      : "   • —";

  return [
    `Standup — ${data.projectName}`,
    ``,
    `Done (${counts.done})`,
    line(byStatus.done),
    ``,
    `In progress (${counts.in_progress})`,
    line(byStatus.in_progress),
    ``,
    `Blocked (${counts.blocked})`,
    line(byStatus.blocked),
    ``,
    `Up next (${counts.todo})`,
    line(byStatus.todo),
    ``,
    blockers.length ? `Blockers heard on the bus:\n${blockers.map((b) => `   • ${b}`).join("\n")}\n` : ``,
    outlook(data),
  ]
    .filter((s) => s !== ``)
    .join("\n");
}

async function llmStandup(data: StandupData): Promise<string> {
  const client = new OpenAI();
  const summary = JSON.stringify(
    {
      project: data.projectName,
      counts: data.counts,
      committed: data.committed,
      tasks: data.byStatus,
      blockers: data.blockers,
    },
    null,
    2,
  );

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `You are the lead agent running a team standup. Given the team's committed work and its status, write a crisp spoken-style standup. Cover: what's done, what's in progress, what's blocked (and the risk), what's up next, and a one-line outlook on whether the team is on track at the current pace. Be specific, name owners, keep it under ~150 words. Plain text with short sections, no markdown headers.`,
      },
      {
        role: "user",
        content: `Here is the current state:\n${summary}`,
      },
    ],
  });

  return (
    res.choices[0]?.message?.content?.trim() ||
    templateStandup(data)
  );
}
