import OpenAI from "openai";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  agents,
  busEvents,
  members,
  tasks,
  type Member,
  type Agent,
} from "./db";
import { pickLead } from "./rbac";

/**
 * The briefing step — the moment the mesh comes alive.
 *
 * After tasks are approved, the lead agent (the agent of the most senior
 * member) "briefs" each assignee's agent: it writes a directed message onto
 * the bus and updates that agent's memory so it knows what its owner now owns.
 *
 * Idempotent: a task that's already been briefed is skipped, so approving the
 * same meeting twice doesn't double-brief.
 */
export async function briefTasks(taskIds: string[]): Promise<number> {
  if (taskIds.length === 0) return 0;

  const rows = await db.select().from(tasks).where(inArray(tasks.id, taskIds));
  const briefable = rows.filter(
    (t) => t.assigneeId && t.status !== "draft",
  );
  if (briefable.length === 0) return 0;

  const projectId = briefable[0].projectId;

  // Skip any task that already has a briefing event.
  const existing = await db
    .select({ relatedTaskId: busEvents.relatedTaskId })
    .from(busEvents)
    .where(
      and(eq(busEvents.projectId, projectId), eq(busEvents.kind, "briefing")),
    );
  const alreadyBriefed = new Set(existing.map((e) => e.relatedTaskId));
  const todo = briefable.filter((t) => !alreadyBriefed.has(t.id));
  if (todo.length === 0) return 0;

  const [team, agentRows] = await Promise.all([
    db.select().from(members).where(eq(members.projectId, projectId)),
    db.select().from(agents).where(eq(agents.projectId, projectId)),
  ]);

  const lead = pickLead(team);
  const leadAgent = lead && agentRows.find((a) => a.memberId === lead.id);
  if (!lead || !leadAgent) return 0;

  const agentByMember = new Map(agentRows.map((a) => [a.memberId, a]));
  const memberById = new Map(team.map((m) => [m.id, m]));

  // Only brief work owned by someone *other* than the lead — the lead doesn't
  // brief itself.
  const directed = todo
    .map((t) => ({ task: t, agent: agentByMember.get(t.assigneeId!) }))
    .filter(
      (x): x is { task: (typeof todo)[number]; agent: Agent } =>
        !!x.agent && x.agent.id !== leadAgent.id,
    );
  if (directed.length === 0) return 0;

  const messages = await briefingMessages(
    directed.map(({ task, agent }) => ({
      taskId: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      estimate: task.estimate,
      assigneeName: memberById.get(task.assigneeId!)?.name ?? "the owner",
      assigneeRole: agent.role,
    })),
    lead.name,
  );

  // Write one briefing event per task, and accumulate memory per agent.
  const memoryAdditions = new Map<string, string[]>();
  for (const { task, agent } of directed) {
    const content =
      messages.get(task.id) ?? defaultBriefing(task.title, task.priority);
    await db.insert(busEvents).values({
      projectId,
      fromAgentId: leadAgent.id,
      toAgentId: agent.id,
      kind: "briefing",
      content,
      relatedTaskId: task.id,
      audience: "team",
    });
    const line = `Owns "${task.title}" — ${task.priority} priority${
      task.estimate ? `, ~${task.estimate}` : ""
    }.`;
    const list = memoryAdditions.get(agent.id) ?? [];
    list.push(line);
    memoryAdditions.set(agent.id, list);
  }

  const now = new Date().toISOString();
  await Promise.all([
    ...[...memoryAdditions.entries()].map(([agentId, lines]) => {
      const agent = agentRows.find((a) => a.id === agentId)!;
      const memory = agent.memory ? `${agent.memory}\n${lines.join("\n")}` : lines.join("\n");
      return db
        .update(agents)
        .set({ memory, lastActiveAt: now })
        .where(eq(agents.id, agentId));
    }),
    db.update(agents).set({ lastActiveAt: now }).where(eq(agents.id, leadAgent.id)),
  ]);

  return directed.length;
}

interface BriefInput {
  taskId: string;
  title: string;
  description: string;
  priority: string;
  estimate: string;
  assigneeName: string;
  assigneeRole: string;
}

async function briefingMessages(
  inputs: BriefInput[],
  leadName: string,
): Promise<Map<string, string>> {
  if (process.env.OPENAI_API_KEY) {
    try {
      return await llmBriefings(inputs, leadName);
    } catch (err) {
      console.error("[mesh] LLM briefing failed, using template:", err);
    }
  }
  return new Map(inputs.map((i) => [i.taskId, defaultBriefing(i.title, i.priority)]));
}

async function llmBriefings(
  inputs: BriefInput[],
  leadName: string,
): Promise<Map<string, string>> {
  const client = new OpenAI();
  const list = inputs
    .map(
      (i) =>
        `- id=${i.taskId} | to=${i.assigneeName} (${i.assigneeRole}) | task="${i.title}" | priority=${i.priority} | "${i.description}"`,
    )
    .join("\n");

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are ${leadName}'s agent, acting as the team lead. For each task, write a short (1-2 sentence) direct briefing to the assignee's agent, in second person, telling them what they now own and why it matters. Be concrete and warm but brief. Return STRICT JSON only.`,
      },
      {
        role: "user",
        content: `Tasks:\n${list}\n\nRespond as {"briefings":[{"taskId":"...","message":"..."}]}`,
      },
    ],
  });

  const content = res.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as {
    briefings?: { taskId?: string; message?: string }[];
  };
  const map = new Map<string, string>();
  for (const b of parsed.briefings ?? []) {
    if (typeof b.taskId === "string" && typeof b.message === "string") {
      map.set(b.taskId, b.message.trim());
    }
  }
  return map;
}

function defaultBriefing(title: string, priority: string): string {
  const lead =
    priority === "high"
      ? "This is high priority — please pick it up first."
      : priority === "low"
        ? "Low priority, fit it in when you can."
        : "Slot this into your queue.";
  return `You're now the owner of "${title}". ${lead} Ping me if you're blocked.`;
}
