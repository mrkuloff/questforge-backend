from fastapi import APIRouter, HTTPException
from ..schemas import Quest, QuestRequest
from ..services.quest_service import generate_quest

router = APIRouter(prefix="/quest", tags=["quest"])


@router.post("", response_model=Quest)
async def create_quest(req: QuestRequest):
    try:
        return await generate_quest(req)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))