"""L2 — Model Context Protocol client.

Launches the official filesystem MCP server (a Node process) over stdio and
exposes a few of its tools to our agents. The server is sandboxed to a single
allowed root — the agent can only touch what we let it, which is exactly the
local-execution guardrail a real per-laptop agent needs.
"""

import os
import subprocess
from contextlib import asynccontextmanager

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# Default sandbox root = the Scrum Agents repo (two levels up from this file).
REPO_ROOT = os.environ.get(
    "MCP_FS_ROOT",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")),
)


def _server_params(root: str) -> StdioServerParameters:
    return StdioServerParameters(
        command="npx",
        args=["-y", "@modelcontextprotocol/server-filesystem", root],
    )


@asynccontextmanager
async def fs_session(root: str = REPO_ROOT):
    async with stdio_client(_server_params(root)) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            yield session


def _text(result) -> str:
    return "\n".join(getattr(c, "text", str(c)) for c in result.content)


async def tool_names(session) -> list[str]:
    res = await session.list_tools()
    return [t.name for t in res.tools]


async def list_directory(session, path: str) -> str:
    return _text(await session.call_tool("list_directory", {"path": path}))


async def read_file(session, path: str, names: list[str]) -> str:
    # the server renamed read_file -> read_text_file in newer versions
    tool = "read_text_file" if "read_text_file" in names else "read_file"
    return _text(await session.call_tool(tool, {"path": path}))


# ---- GitHub MCP server ----------------------------------------------------

def github_token() -> str | None:
    """Find a token without making the user paste one: env first, then an
    existing `gh` CLI login."""
    tok = os.environ.get("GITHUB_TOKEN") or os.environ.get("GITHUB_PERSONAL_ACCESS_TOKEN")
    if tok:
        return tok
    try:
        out = subprocess.run(
            ["gh", "auth", "token"], capture_output=True, text=True, timeout=5
        )
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout.strip()
    except Exception:
        pass
    return None


@asynccontextmanager
async def github_session(token: str | None = None):
    tok = token or github_token()
    env = {**os.environ}
    if tok:
        env["GITHUB_PERSONAL_ACCESS_TOKEN"] = tok
    params = StdioServerParameters(
        command="npx",
        args=["-y", "@modelcontextprotocol/server-github"],
        env=env,
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            yield session


async def list_commits(session, owner: str, repo: str, per_page: int = 30) -> str:
    return _text(
        await session.call_tool(
            "list_commits", {"owner": owner, "repo": repo, "perPage": per_page}
        )
    )
