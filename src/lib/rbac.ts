import type { Role } from "./db/schema";

/**
 * Role-based access control for the agent mesh.
 *
 * A member's role IS their agent's permission profile — the human and their
 * agent can do exactly the same things. There's no real auth yet (identity
 * comes from the "Acting as" cookie); this map is the single source of truth
 * for who can do what, and it's what Better Auth will enforce later.
 */

// Highest -> lowest. The "lead agent" is simply the agent of the
// highest-ranked member on the project.
export const ROLE_PRIORITY: Role[] = ["pm", "tl", "sde2", "sde1", "qa"];

export type Capability =
  | "runStandup" // ask the lead agent to synthesize team status
  | "briefAgents" // push briefings to sub-agents after a meeting
  | "approveTasks" // approve drafted tasks
  | "pushTasks" // push approved tasks to Jira/Linear
  | "seeAllTasks" // see every task, not just your own
  | "seeLeadsBus" // read "leads"-audience bus chatter
  | "postProgress"; // report progress / blockers on your own work

const LEAD: Capability[] = [
  "runStandup",
  "briefAgents",
  "approveTasks",
  "pushTasks",
  "seeAllTasks",
  "seeLeadsBus",
  "postProgress",
];

const IC: Capability[] = ["postProgress"];

// pm and tl are "leads" with the full orchestration aperture; everyone else
// is an individual contributor who can see the team but only drive their own work.
const CAPABILITIES: Record<Role, Capability[]> = {
  pm: LEAD,
  tl: LEAD,
  sde2: IC,
  sde1: IC,
  qa: IC,
};

export function can(role: Role, cap: Capability): boolean {
  return CAPABILITIES[role]?.includes(cap) ?? false;
}

export function isLead(role: Role): boolean {
  return role === "pm" || role === "tl";
}

/** Rank for sorting; lower number = more senior. Unknown roles sort last. */
export function rank(role: Role): number {
  const i = ROLE_PRIORITY.indexOf(role);
  return i === -1 ? ROLE_PRIORITY.length : i;
}

/** Pick the lead from a set of members/agents: the most senior role. */
export function pickLead<T extends { role: Role }>(people: T[]): T | undefined {
  return [...people].sort((a, b) => rank(a.role) - rank(b.role))[0];
}
