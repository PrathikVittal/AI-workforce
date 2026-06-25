"""Smoke-test the CrewAI lead crew end to end on the local model.

  OLLAMA_API_BASE=http://localhost:11434 python -m scrum_agents.run_crew
"""

from . import crew

ROSTER = [
    {"name": "Priya Nair", "role": "pm"},
    {"name": "Marcus Lee", "role": "tl"},
    {"name": "Aisha Khan", "role": "sde2"},
    {"name": "Lena Ortiz", "role": "qa"},
]

TRANSCRIPT = """\
Priya (PM): For sprint 7 the headline is the customer portal. Login works but we still
need password reset and email verification.
Marcus (TL): I'll own the email verification service. Aisha, can you take the
password-reset flow end to end?
Aisha (SDE2): Yes, I'll build the reset flow with token expiry.
Lena (QA): I'll write the regression suite for the auth flows once those land.
Priya (PM): Good. Password reset is the top priority — it's blocking the launch.
"""


def main() -> None:
    print("=== Task extraction (CrewAI lead agent) ===")
    tasks = crew.extract_tasks(TRANSCRIPT, ROSTER)
    if not tasks:
        print("  (no tasks parsed)")
    for t in tasks:
        print(f"  • [{t.get('priority','?')}] {t.get('title','?')} → {t.get('assignee','unassigned')} ({t.get('estimate','')})")

    print("\n=== Standup (CrewAI lead agent) ===")
    signals = [
        "Aisha finished the password-reset flow and opened a PR.",
        "Marcus is in progress on the email verification service.",
        "Lena is blocked on the auth regression suite — waiting on the reset PR to merge.",
    ]
    print(crew.run_standup(signals))


if __name__ == "__main__":
    main()
