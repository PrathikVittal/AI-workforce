"""Run the LangGraph meeting pipeline end to end and prove its three claims:

  1. stateful steps   — watch each node finish, streaming
  2. durable state    — checkpoints are in Postgres, listed after the run
  3. memory pays off  — semantically recall a briefing from pgvector

  OLLAMA_API_BASE=http://localhost:11434 python -m scrum_agents.run_graph
"""

from . import graph as g
from . import memory
from .run_crew import ROSTER, TRANSCRIPT

THREAD = {"configurable": {"thread_id": "sprint-7-planning"}}


def main() -> None:
    with g.open_checkpointer() as saver:
        saver.setup()
        pipeline = g.build_graph(saver)

        print("=== Streaming the meeting pipeline (extract → brief → remember) ===")
        for update in pipeline.stream(
            {"transcript": TRANSCRIPT, "roster": ROSTER}, THREAD, stream_mode="updates"
        ):
            for node, out in update.items():
                keys = ", ".join(f"{k}={summ(v)}" for k, v in out.items())
                print(f"  ✓ node {node!r} done → {keys}")

        final = pipeline.get_state(THREAD).values
        print("\n=== Final state ===")
        for t in final.get("tasks", []):
            print(f"  • [{t.get('priority','?')}] {t.get('title','?')} → {t.get('assignee','—')}")
        for b in final.get("briefings", []):
            print(f"  ✉ {b['assignee']}: {b['text'][:90]}…")

        checkpoints = list(saver.list(THREAD))
        print(f"\n=== Durability: {len(checkpoints)} checkpoints persisted in Postgres "
              f"for thread 'sprint-7-planning' ===")

    print("\n=== Recall from agent memory (pgvector) ===")
    q = "what is Aisha responsible for?"
    print(f"Q: {q}")
    for content, score in memory.recall("aisha-khan-agent", q, k=1):
        print(f"   → ({score:.3f}) {content}")


def summ(v) -> str:
    if isinstance(v, list):
        return f"{len(v)} item(s)"
    return str(v)[:40]


if __name__ == "__main__":
    main()
