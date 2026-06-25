"""Environment-driven configuration for the agent service.

One knob matters most: LLM_PROVIDER. Default "ollama" keeps everything local and
free (the model on your Mac); set it to "openai" to flip to the cloud API for
quality. Nothing else in the codebase needs to change when you toggle it.
"""

import os
from dataclasses import dataclass
from getpass import getuser

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    # L1 — NATS bus
    nats_url: str = os.environ.get("NATS_URL", "nats://localhost:4222")

    # Shared Postgres (defaults to the local brew server, current OS user, trust auth)
    database_url: str = os.environ.get(
        "DATABASE_URL", f"postgresql://{getuser()}@localhost:5432/scrum"
    )

    # LLM toggle
    llm_provider: str = os.environ.get("LLM_PROVIDER", "ollama").lower()
    ollama_base_url: str = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1")
    ollama_model: str = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b")
    openai_api_key: str = os.environ.get("OPENAI_API_KEY", "")
    openai_model: str = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

    # Embeddings (for pgvector memory/RAG later)
    embed_model: str = os.environ.get("EMBED_MODEL", "nomic-embed-text")


settings = Settings()
