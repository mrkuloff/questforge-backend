from openai import AsyncOpenAI
from ..config import config_manager


async def chat(system: str, user: str) -> str:
    cfg = config_manager.get().llm
    client = AsyncOpenAI(
        base_url=cfg.base_url,
        api_key=cfg.token or "not-needed",
        timeout=cfg.timeout_s,
    )
    resp = await client.chat.completions.create(
        model=cfg.model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.7,
        max_tokens=4096,
    )
    return resp.choices[0].message.content or ""