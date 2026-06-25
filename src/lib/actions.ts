"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  agents,
  busEvents,
  meetings,
  members,
  projects,
  tasks,
  type WorkStatus,
} from "@/lib/db";
import { extractTasks } from "@/lib/llm/extract";
import { ACTING_AS_COOKIE, getCurrentMember } from "@/lib/identity";
import { can, pickLead } from "@/lib/rbac";
import { briefTasks } from "@/lib/mesh";
import { generateStandup } from "@/lib/standup";

/**
 * "Acting as" switcher — set the current identity cookie (stands in for login).
 * Called directly from the client, which then calls router.refresh(): a cookie
 * set here isn't visible to components re-rendered in THIS response, so the
 * client triggers a fresh request that reads the new value.
 */
export async function setActingAs(memberId: string) {
  if (!memberId) return;
  const jar = await cookies();
  jar.set(ACTING_AS_COOKIE, memberId, { path: "/", sameSite: "lax" });
}

/** Create a meeting from a transcript, run the lead agent, store draft tasks. */
export async function createMeeting(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim() || "Untitled meeting";
  const transcript = String(formData.get("transcript") ?? "").trim();
  if (!projectId || !transcript) redirect("/meeting/new");

  const inserted = await db
    .insert(meetings)
    .values({ projectId, title, transcript })
    .returning();
  const meeting = inserted[0];

  const roster = await db
    .select()
    .from(members)
    .where(eq(members.projectId, projectId));

  const drafts = await extractTasks({
    transcript,
    projectName: title,
    roster: roster.map((m) => ({ id: m.id, name: m.name, role: m.role })),
  });

  if (drafts.length) {
    await db.insert(tasks).values(
      drafts.map((d) => ({
        meetingId: meeting.id,
        projectId,
        title: d.title,
        description: d.description,
        assigneeId: roster.find((m) => m.name === d.assigneeName)?.id ?? null,
        priority: d.priority,
        estimate: d.estimate,
      })),
    );
  }

  revalidatePath("/");
  redirect(`/review/${meeting.id}`);
}

async function meetingIdOf(taskId: string): Promise<string | null> {
  const row = await db
    .select({ meetingId: tasks.meetingId })
    .from(tasks)
    .where(eq(tasks.id, taskId));
  return row[0]?.meetingId ?? null;
}

/** Edit a draft task's assignee and/or priority. */
export async function updateTask(formData: FormData) {
  const id = String(formData.get("taskId") ?? "");
  if (!id) return;

  const rawAssignee = formData.get("assigneeId");
  const rawPriority = formData.get("priority");

  const patch: { assigneeId?: string | null; priority?: "low" | "medium" | "high" } =
    {};
  if (rawAssignee !== null)
    patch.assigneeId = rawAssignee === "" ? null : String(rawAssignee);
  if (rawPriority === "low" || rawPriority === "medium" || rawPriority === "high")
    patch.priority = rawPriority;

  if (Object.keys(patch).length === 0) return;
  await db.update(tasks).set(patch).where(eq(tasks.id, id));

  const meetingId = await meetingIdOf(id);
  if (meetingId) revalidatePath(`/review/${meetingId}`);
  revalidatePath("/board");
}

/** A lead approves a single draft task — then the lead agent briefs its owner. */
export async function approveTask(formData: FormData) {
  const actor = await getCurrentMember();
  if (!actor || !can(actor.role, "approveTasks")) return;

  const id = String(formData.get("taskId") ?? "");
  if (!id) return;
  await db.update(tasks).set({ status: "approved" }).where(eq(tasks.id, id));
  await briefTasks([id]); // lead agent briefs the assignee's agent

  const meetingId = await meetingIdOf(id);
  if (meetingId) revalidatePath(`/review/${meetingId}`);
  revalidatePath("/board");
  revalidatePath("/mesh");
  revalidatePath("/");
}

/** A lead approves every remaining draft task for a meeting, then briefs the team. */
export async function approveAllForMeeting(formData: FormData) {
  const actor = await getCurrentMember();
  if (!actor || !can(actor.role, "approveTasks")) return;

  const meetingId = String(formData.get("meetingId") ?? "");
  if (!meetingId) return;

  const drafts = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.meetingId, meetingId), eq(tasks.status, "draft")));

  await db
    .update(tasks)
    .set({ status: "approved" })
    .where(and(eq(tasks.meetingId, meetingId), eq(tasks.status, "draft")));

  await briefTasks(drafts.map((d) => d.id));

  revalidatePath(`/review/${meetingId}`);
  revalidatePath("/board");
  revalidatePath("/mesh");
  revalidatePath("/");
}

/** Reject (delete) a draft task. */
export async function deleteTask(formData: FormData) {
  const id = String(formData.get("taskId") ?? "");
  if (!id) return;
  const meetingId = await meetingIdOf(id);
  await db.delete(tasks).where(eq(tasks.id, id));
  if (meetingId) revalidatePath(`/review/${meetingId}`);
  revalidatePath("/board");
}

/**
 * Simulated push to Jira/Linear. Today this just flips the status so the
 * pipeline is demoable end to end; a real adapter slots in here later.
 */
export async function pushTask(formData: FormData) {
  const actor = await getCurrentMember();
  if (!actor || !can(actor.role, "pushTasks")) return;

  const id = String(formData.get("taskId") ?? "");
  if (!id) return;
  await db.update(tasks).set({ status: "pushed" }).where(eq(tasks.id, id));
  revalidatePath("/board");
}

export async function pushAllApproved(formData: FormData) {
  const actor = await getCurrentMember();
  if (!actor || !can(actor.role, "pushTasks")) return;

  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return;
  await db
    .update(tasks)
    .set({ status: "pushed" })
    .where(and(eq(tasks.projectId, projectId), eq(tasks.status, "approved")));
  revalidatePath("/board");
}

/**
 * Day-to-day work progress — the gossip layer. When you (acting as someone)
 * move a task, that person's agent posts the update to the bus so the rest of
 * the mesh — and the next standup — sees it.
 */
export async function updateWorkStatus(taskId: string, workStatus: WorkStatus) {
  const actor = await getCurrentMember();
  if (!actor) return;

  const valid: WorkStatus[] = ["todo", "in_progress", "blocked", "done"];
  if (!taskId || !valid.includes(workStatus)) return;

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) return;

  // Only the owner (or a lead) can move a task.
  const isOwner = task.assigneeId === actor.id;
  if (!isOwner && !can(actor.role, "seeAllTasks")) return;

  await db.update(tasks).set({ workStatus }).where(eq(tasks.id, taskId));

  // The actor's agent gossips about the change.
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.memberId, actor.id));
  if (agent) {
    const verb: Record<WorkStatus, string> = {
      todo: "moved back to To-do",
      in_progress: "started",
      blocked: "flagged as blocked",
      done: "finished",
    };
    await db.insert(busEvents).values({
      projectId: task.projectId,
      fromAgentId: agent.id,
      kind: workStatus === "blocked" ? "blocker" : "progress",
      content: `${actor.name} ${verb[workStatus]} "${task.title}".`,
      relatedTaskId: task.id,
      audience: "team",
    });
    await db
      .update(agents)
      .set({ lastActiveAt: new Date().toISOString() })
      .where(eq(agents.id, agent.id));
  }

  revalidatePath("/board");
  revalidatePath("/mesh");
}

/** A lead asks the lead agent to run standup; the result is posted to the bus. */
export async function runStandup(formData: FormData) {
  const actor = await getCurrentMember();
  if (!actor || !can(actor.role, "runStandup")) return;

  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return;

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));
  if (!project) return;

  const report = await generateStandup(projectId, project.name);

  // Posted by the lead agent (most senior member's agent).
  const [team, agentRows] = await Promise.all([
    db.select().from(members).where(eq(members.projectId, projectId)),
    db.select().from(agents).where(eq(agents.projectId, projectId)),
  ]);
  const lead = pickLead(team);
  const leadAgent = lead && agentRows.find((a) => a.memberId === lead.id);
  if (leadAgent) {
    await db.insert(busEvents).values({
      projectId,
      fromAgentId: leadAgent.id,
      kind: "standup",
      content: report,
      audience: "team",
    });
  }

  revalidatePath("/mesh");
}
