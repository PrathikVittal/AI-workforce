"""An agent reads real commits through the GitHub MCP server and reports
team velocity — the signal a lead agent folds into standups.

  python -m scrum_agents.run_github_demo --repo modelcontextprotocol/python-sdk

Token discovery is automatic: GITHUB_TOKEN env var, or an existing `gh auth
login`. Without one, GitHub rejects API calls — the demo says so and exits
cleanly instead of crashing.
"""

import argparse
import asyncio
import json
from collections import Counter

from . import llm, mcp_tools


def summarize_commits(raw: str) -> tuple[Counter, list[str]]:
    commits = json.loads(raw)
    by_author: Counter = Counter()
    recent: list[str] = []
    for c in commits:
        commit = c.get("commit", {})
        author = (commit.get("author") or {}).get("name") or "unknown"
        by_author[author] += 1
        msg = (commit.get("message") or "").splitlines()[0]
        recent.append(f"{author}: {msg}")
    return by_author, recent


async def main(repo_full: str) -> None:
    owner, repo = repo_full.split("/", 1)

    tok = mcp_tools.github_token()
    print(f"GitHub token: {'found (' + tok[:8] + '…)' if tok else 'none found'}")
    if not tok:
        print(
            "\nNo GitHub credentials available. Run `gh auth login` (or set "
            "GITHUB_TOKEN) and re-run — the integration is wired and will work "
            "as soon as a token exists."
        )
        return

    async with mcp_tools.github_session(tok) as session:
        res = await session.list_tools()
        print(f"GitHub MCP tools exposed: {len(res.tools)} (e.g. "
              + ", ".join(t.name for t in res.tools[:5]) + ", …)\n")

        raw = await mcp_tools.list_commits(session, owner, repo, per_page=30)

    by_author, recent = summarize_commits(raw)
    print(f"Last {sum(by_author.values())} commits on {repo_full} (via MCP):")
    for author, n in by_author.most_common(5):
        print(f"  • {author}: {n} commit(s)")

    blurb = llm.complete(
        "You are a lead agent reporting engineering velocity. Given these recent "
        f"commits on {repo_full}, give a 2-3 sentence velocity read — who is most "
        "active and what the work focuses on:\n\n" + "\n".join(recent[:30]),
        system="You are a concise engineering lead.",
    )
    print(f"\n=== Velocity read (local model, fed by GitHub MCP) ===\n{blurb}")


def cli() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--repo", default="modelcontextprotocol/python-sdk")
    a = p.parse_args()
    asyncio.run(main(a.repo))


if __name__ == "__main__":
    cli()
