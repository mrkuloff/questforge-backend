import asyncio
import base64
import httpx
from ..config import config_manager, ImageConfig


# 1x1 прозрачный PNG — отдаётся в stub-режиме
_STUB_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


async def generate_image(prompt: str) -> bytes:
    cfg = config_manager.get().image
    if cfg.driver == "stub":
        return _STUB_PNG
    if cfg.driver == "a1111":
        return await _a1111(prompt, cfg)
    if cfg.driver == "openai_images":
        return await _openai_images(prompt, cfg)
    raise ValueError(f"Unsupported image driver: {cfg.driver}")


async def _a1111(prompt: str, cfg: ImageConfig) -> bytes:
    payload = {
        "prompt": prompt,
        "negative_prompt": "blurry, low quality, deformed, ugly, text, watermark",
        "width": cfg.width,
        "height": cfg.height,
        "steps": cfg.steps,
        "sampler_name": "DPM++ 2M Karras",
        "cfg_scale": 7.0,
    }
    async with httpx.AsyncClient(timeout=cfg.timeout_s) as client:
        r = await client.post(
            f"{cfg.base_url.rstrip('/')}/sdapi/v1/txt2img", json=payload
        )
        r.raise_for_status()
        return base64.b64decode(r.json()["images"][0])


async def _openai_images(prompt: str, cfg: ImageConfig) -> bytes:
    headers = {"Authorization": f"Bearer {cfg.token}"} if cfg.token else {}
    payload = {
        "model": cfg.model or "dall-e-3",
        "prompt": prompt,
        "size": f"{cfg.width}x{cfg.height}",
        "response_format": "b64_json",
    }
    async with httpx.AsyncClient(timeout=cfg.timeout_s) as client:
        r = await client.post(
            f"{cfg.base_url.rstrip('/')}/v1/images/generations",
            headers=headers,
            json=payload,
        )
        r.raise_for_status()
        return base64.b64decode(r.json()["data"][0]["b64_json"])
