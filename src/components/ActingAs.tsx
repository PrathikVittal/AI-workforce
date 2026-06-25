"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setActingAs } from "@/lib/actions";
import { ROLE_LABEL } from "@/lib/ui";

interface MemberLite {
  id: string;
  name: string;
  role: string;
}

/**
 * The "Acting as" switcher — stands in for login while there's no auth.
 * Controlled + optimistic: the picked value sticks immediately, then we set
 * the cookie and router.refresh() so the server re-renders as the new person
 * (a cookie set inside the action isn't visible until a fresh request).
 */
export function ActingAs({
  members,
  currentId,
}: {
  members: MemberLite[];
  currentId: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentId);
  const [pending, startTransition] = useTransition();

  return (
    <div className="row" style={{ gap: "0.4rem" }}>
      <span className="muted small" style={{ whiteSpace: "nowrap" }}>
        Acting as
      </span>
      <select
        name="memberId"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const id = e.target.value;
          setValue(id);
          startTransition(async () => {
            await setActingAs(id);
            router.refresh();
          });
        }}
        className="select"
        style={{ width: "auto", padding: "0.3rem 0.5rem", fontSize: "0.82rem" }}
      >
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} · {ROLE_LABEL[m.role] ?? m.role}
          </option>
        ))}
      </select>
    </div>
  );
}
