import { pgTable, text } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => nanoid(12));

const createdAt = () =>
  text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString());

export const projects = pgTable("projects", {
  id: id(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("active"),
  createdAt: createdAt(),
});

export const members = pgTable("members", {
  id: id(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  // role doubles as the agent role for the agent mesh (RBAC)
  role: text("role", { enum: ["pm", "tl", "sde2", "sde1", "qa"] }).notNull(),
  createdAt: createdAt(),
});

export const meetings = pgTable("meetings", {
  id: id(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  title: text("title").notNull(),
  transcript: text("transcript").notNull().default(""),
  status: text("status", { enum: ["processed", "empty"] })
    .notNull()
    .default("processed"),
  createdAt: createdAt(),
});

export const tasks = pgTable("tasks", {
  id: id(),
  meetingId: text("meeting_id").references(() => meetings.id),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  assigneeId: text("assignee_id").references(() => members.id),
  priority: text("priority", { enum: ["low", "medium", "high"] })
    .notNull()
    .default("medium"),
  estimate: text("estimate").notNull().default(""),
  // The approval pipeline: draft -> approved (by PM) -> pushed (to Jira/Linear).
  status: text("status", { enum: ["draft", "approved", "pushed"] })
    .notNull()
    .default("draft"),
  // The work pipeline — orthogonal to `status`. This is what agents/humans
  // update day to day, and what standup reads to report progress.
  workStatus: text("work_status", {
    enum: ["todo", "in_progress", "blocked", "done"],
  })
    .notNull()
    .default("todo"),
  createdAt: createdAt(),
});

// One AI agent per member. The agent's role mirrors its owner's role and IS
// its permission profile (see lib/rbac.ts). `memory` is the agent's running
// understanding of what its owner is working on.
export const agents = pgTable("agents", {
  id: id(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id),
  role: text("role", { enum: ["pm", "tl", "sde2", "sde1", "qa"] }).notNull(),
  memory: text("memory").notNull().default(""),
  lastActiveAt: text("last_active_at"),
  createdAt: createdAt(),
});

// The shared team bus — an append-only log of everything agents "say".
// Briefings are directed (toAgentId set); gossip is broadcast (toAgentId null).
export const busEvents = pgTable("bus_events", {
  id: id(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  fromAgentId: text("from_agent_id")
    .notNull()
    .references(() => agents.id),
  toAgentId: text("to_agent_id").references(() => agents.id),
  kind: text("kind", {
    enum: ["briefing", "progress", "blocker", "standup", "note"],
  }).notNull(),
  content: text("content").notNull(),
  relatedTaskId: text("related_task_id").references(() => tasks.id),
  // RBAC read-scope: "team" is visible to everyone on the project,
  // "leads" only to pm/tl agents and their owners.
  audience: text("audience", { enum: ["team", "leads"] })
    .notNull()
    .default("team"),
  createdAt: createdAt(),
});

export type Project = typeof projects.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Meeting = typeof meetings.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type BusEvent = typeof busEvents.$inferSelect;

export type Role = Member["role"];
export type Priority = Task["priority"];
export type TaskStatus = Task["status"];
export type WorkStatus = Task["workStatus"];
export type BusKind = BusEvent["kind"];
