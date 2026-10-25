from fastapi import APIRouter
from ..config import AppConfig, config_manager

router = APIRouter(prefix="/config", tags=["config"])


def _mask(cfg: AppConfig) -> dict:
    data = cfg.model_dump()
    data["llm"]["token"] = "***" if data["llm"]["token"] else ""
    data["image"]["token"] = "***" if data["image"]["token"] else ""
    return data


@router.get("")
def get_config():
    return _mask(config_manager.get())


@router.put("")
def update_config(cfg: AppConfig):
    current = config_manager.get()
    if cfg.llm.token == "***":
        cfg.llm.token = current.llm.token
    if cfg.image.token == "***":
        cfg.image.token = current.image.token
    config_manager.update(cfg)
    return _mask(cfg)