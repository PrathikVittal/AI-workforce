"use client";

import { useState, useTransition } from "react";
import { updateWorkStatus } from "@/lib/actions";
import type { WorkStatus } from "@/lib/db";

const OPTIONS: [WorkStatus, string][] = [
  ["todo", "To-do"],
  ["in_progress", "In progress"],
  ["blocked", "Blocked"],
  ["done", "Done"],
];

/**
 * Moving a task posts to the bus as the current actor's agent. Optimistic:
 * the dropdown updates instantly and the server action runs in a transition,
 * so there's no round-trip lag. Server-side RBAC still decides if the move
 * sticks (owner or a lead).
 */
export function WorkStatusControl({
  taskId,
  value,
}: {
  taskId: string;
  value: WorkStatus;
}) {
  const [val, setVal] = useState<WorkStatus>(value);
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={val}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as WorkStatus;
        setVal(next);
        startTransition(async () => {
          await updateWorkStatus(taskId, next);
        });
      }}
      className="select"
      style={{
        width: "auto",
        padding: "0.25rem 0.45rem",
        fontSize: "0.76rem",
        opacity: pending ? 0.6 : 1,
      }}
    >
      {OPTIONS.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
