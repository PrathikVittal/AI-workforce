import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, members, agents, type Member, type Agent } from "./db";
import { pickLead } from "./rbac";

/**
 * "Who am I right now." There's no real auth in v1 — identity is just a
 * cookie holding a member id, set by the "Acting as" switcher in the header.
 * When unset (or stale), we default to the most senior member so the app is
 * usable on first load. Better Auth replaces this later without changing callers.
 */

export const ACTING_AS_COOKIE = "actingAs";

export async function getCurrentMember(): Promise<Member | null> {
  const all = await db.select().from(members);
  if (all.length === 0) return null;
  const jar = await cookies();
  const id = jar.get(ACTING_AS_COOKIE)?.value;
  const found = id ? all.find((m) => m.id === id) : undefined;
  return found ?? pickLead(all) ?? all[0];
}

export async function getCurrentAgent(): Promise<Agent | null> {
  const member = await getCurrentMember();
  if (!member) return null;
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.memberId, member.id));
  return agent ?? null;
}
