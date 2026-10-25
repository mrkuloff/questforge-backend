import base64
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..clients.image import generate_image

router = APIRouter(prefix="/image", tags=["image"])


class ImageRequest(BaseModel):
    prompt: str


class ImageResponse(BaseModel):
    image_b64: str


@router.post("", response_model=ImageResponse)
async def create_image(req: ImageRequest):
    try:
        data = await generate_image(req.prompt)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    return ImageResponse(image_b64=base64.b64encode(data).decode())