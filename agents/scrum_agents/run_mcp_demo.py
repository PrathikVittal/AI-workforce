"""An agent reads real code through MCP, then reviews it with the local model.

  python -m scrum_agents.run_mcp_demo

This is capability B (the on-laptop copilot) in miniature: real filesystem
access via MCP feeding real reasoning via the LLM.
"""

import asyncio

from . import llm, mcp_tools

TARGET = "src/lib/rbac.ts"  # a real file in this repo


async def main() -> None:
    root = mcp_tools.REPO_ROOT
    print(f"MCP filesystem server sandboxed to: {root}\n")

    async with mcp_tools.fs_session(root) as session:
        names = await mcp_tools.tool_names(session)
        print("MCP tools exposed:", ", ".join(names), "\n")

        listing = await mcp_tools.list_directory(session, f"{root}/src/lib")
        print(f"src/lib (via MCP):\n{listing}\n")

        code = await mcp_tools.read_file(session, f"{root}/{TARGET}", names)
        print(f"Read {TARGET} via MCP: {len(code)} chars\n")

    review = llm.complete(
        f"Review this TypeScript file in 3 short bullets — what it does and any risk:\n\n{code[:4000]}",
        system="You are a senior engineer doing a quick, concrete code review.",
    )
    print("=== Agent code review (local model, fed by MCP) ===")
    print(review)


if __name__ == "__main__":
    asyncio.run(main())
