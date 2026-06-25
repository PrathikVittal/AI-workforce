"""Unified LLM access.

Ollama exposes an OpenAI-compatible endpoint, so a single client covers both
providers — only the base URL, key, and model name change. `litellm_model()`
returns the provider-prefixed string CrewAI/LangGraph expect.
"""

from openai import OpenAI

from .config import settings


def _client() -> OpenAI:
    if settings.llm_provider == "openai":
        return OpenAI(api_key=settings.openai_api_key)
    # Ollama ignores the key but the SDK requires a non-empty one.
    return OpenAI(base_url=settings.ollama_base_url, api_key="ollama")


def model_name() -> str:
    return settings.openai_model if settings.llm_provider == "openai" else settings.ollama_model


def litellm_model() -> str:
    """Provider-prefixed model id for CrewAI / LangGraph (litellm convention)."""
    if settings.llm_provider == "openai":
        return f"openai/{settings.openai_model}"
    return f"ollama/{settings.ollama_model}"


def embed(texts: list[str]) -> list[list[float]]:
    """Embeddings always run on local Ollama (free, and keeps vector dims
    stable at 768 even when the chat LLM is toggled to the cloud)."""
    client = OpenAI(base_url=settings.ollama_base_url, api_key="ollama")
    res = client.embeddings.create(model=settings.embed_model, input=texts)
    return [d.embedding for d in res.data]


def complete(prompt: str, system: str | None = None, temperature: float = 0.3) -> str:
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    res = _client().chat.completions.create(
        model=model_name(),
        messages=messages,
        temperature=temperature,
    )
    return (res.choices[0].message.content or "").strip()
