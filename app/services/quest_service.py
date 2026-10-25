import json
from ..clients.llm import chat
from ..config import config_manager
from ..prompts import SYSTEM_PROMPT, build_user_prompt, clean_output
from ..schemas import Quest, QuestRequest


async def generate_quest(req: QuestRequest) -> Quest:
    cfg = config_manager.get().llm
    last_err: Exception | None = None
    for attempt in range(cfg.max_retries):
        user_prompt = build_user_prompt(
            topic=req.topic,
            genre=req.genre,
            difficulty=req.difficulty,
            n=req.n,
            include_theory=req.include_theory,
            variant=attempt,
        )
        try:
            raw = await chat(SYSTEM_PROMPT, user_prompt)
            data = json.loads(clean_output(raw))
            return Quest.model_validate(data)
        except Exception as e:
            last_err = e
    raise RuntimeError(
        f"Failed to generate valid quest after {cfg.max_retries} attempts: {last_err}"
    )