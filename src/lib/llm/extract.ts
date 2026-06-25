import OpenAI from "openai";
import type { Role } from "../db/schema";

export interface RosterMember {
  id: string;
  name: string;
  role: Role;
}

export interface DraftTask {
  title: string;
  description: string;
  assigneeName: string | null;
  priority: "low" | "medium" | "high";
  estimate: string;
}

const SYSTEM = `You are the lead agent — the acting Scrum Master / Project Manager for a software team.
You just listened to a team meeting. Extract the concrete engineering tasks the team decided to do.

Rules:
- One task per distinct piece of work. Be specific and actionable.
- Pick the best assignee from the roster by role fit and by what was said in the meeting.
- Never assign work to a PM. Prefer SDE roles for build work and QA for testing work.
- Give a rough estimate ("2d", "3pts", "half day") and a priority.
- Only include work that was actually discussed. Do not invent tasks.
Return STRICT JSON only, no prose.`;

export async function extractTasks(opts: {
  transcript: string;
  roster: RosterMember[];
  projectName: string;
}): Promise<DraftTask[]> {
  const { transcript, roster, projectName } = opts;
  if (process.env.OPENAI_API_KEY) {
    try {
      return await llmExtract(transcript, roster, projectName);
    } catch (err) {
      console.error("[extract] LLM failed, using heuristic fallback:", err);
    }
  }
  return mockExtract(transcript, roster);
}

async function llmExtract(
  transcript: string,
  roster: RosterMember[],
  projectName: string,
): Promise<DraftTask[]> {
  const client = new OpenAI();
  const rosterText = roster.map((m) => `- ${m.name} (${m.role})`).join("\n");

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Project: ${projectName}

Team roster:
${rosterText}

Meeting transcript:
"""
${transcript}
"""

Respond with JSON of exactly this shape:
{"tasks":[{"title":"short imperative title","description":"1-2 sentences","assigneeName":"<one roster name or null>","priority":"low|medium|high","estimate":"e.g. 2d or 3pts"}]}`,
      },
    ],
  });

  const content = res.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as { tasks?: unknown };
  const raw = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  return raw.map((t) => normalize(t, roster)).filter((t): t is DraftTask => t !== null);
}

function normalize(t: unknown, roster: RosterMember[]): DraftTask | null {
  if (!t || typeof t !== "object") return null;
  const o = t as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  if (!title) return null;
  const names = new Set(roster.map((m) => m.name));
  const assigneeName =
    typeof o.assigneeName === "string" && names.has(o.assigneeName)
      ? o.assigneeName
      : null;
  const priority =
    o.priority === "high" || o.priority === "low" ? o.priority : "medium";
  return {
    title,
    description: typeof o.description === "string" ? o.description : "",
    assigneeName,
    priority,
    estimate: typeof o.estimate === "string" ? o.estimate : "",
  };
}

// ---- Free, zero-key fallback: a deterministic heuristic extractor ----

const ACTION_RE =
  /\b(need to|needs to|have to|has to|should|will|must|let'?s|implement|build|create|add|fix|set up|setup|integrate|design|write|refactor|test|deploy|investigate|handle|update|migrate|review|wire up|hook up)\b/i;
const HIGH_RE =
  /\b(urgent|asap|critical|blocker|blocking|immediately|p0|high[- ]priority|by (today|tomorrow|eod))\b/i;
const LOW_RE = /\b(later|eventually|nice to have|low priority|someday|backlog|if we have time)\b/i;
const LEAD_FILLER_RE =
  /^(ok(ay)?|so|then|also|and|right|alright|yeah|well|i think|i guess|maybe|we|we'?ll|we should|we need to|we have to|let'?s|i'?ll|you should|can you|could you|please)\b[\s,:-]*/i;

function mockExtract(transcript: string, roster: RosterMember[]): DraftTask[] {
  const assignables = roster.filter((m) => m.role !== "pm");
  const sentences = transcript
    .split(/\n|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);

  let candidates = sentences.filter((s) => ACTION_RE.test(s)).slice(0, 8);
  if (candidates.length === 0) candidates = sentences.slice(0, 3);

  let i = 0;
  return candidates.map((line) => {
    const assignee = assignables.length
      ? assignables[i++ % assignables.length]
      : null;
    const priority = HIGH_RE.test(line)
      ? "high"
      : LOW_RE.test(line)
        ? "low"
        : "medium";
    return {
      title: toTitle(line),
      description: line,
      assigneeName: assignee ? assignee.name : null,
      priority,
      estimate: "",
    };
  });
}

function toTitle(line: string): string {
  let s = line.replace(LEAD_FILLER_RE, "").trim();
  s = s.replace(/[.?!,;:]+$/g, "");
  const words = s.split(/\s+/);
  if (words.length > 10) s = words.slice(0, 10).join(" ") + "…";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
