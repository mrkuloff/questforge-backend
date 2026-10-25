from pathlib import Path
import threading
import yaml
from typing import Literal
from pydantic import BaseModel

CONFIG_PATH = Path(__file__).resolve().parent / "config.yaml"


class LLMConfig(BaseModel):
    base_url: str
    model: str
    token: str = ""
    timeout_s: int = 300
    max_retries: int = 3


class ImageConfig(BaseModel):
    driver: Literal["stub", "a1111", "openai_images"] = "stub"
    base_url: str = ""
    model: str = ""
    token: str = ""
    width: int = 1024
    height: int = 576
    steps: int = 25
    timeout_s: int = 300


class AppConfig(BaseModel):
    llm: LLMConfig
    image: ImageConfig

class ConfigManager:
    """Читает config.yaml с горячей перезагрузкой по mtime, безопасно пишет."""

    def __init__(self, path: Path):
        self.path = path
        self._lock = threading.Lock()
        self._cached: AppConfig | None = None
        self._cached_mtime: float = 0.0

    def get(self) -> AppConfig:
        try:
            mtime = self.path.stat().st_mtime
        except FileNotFoundError:
            raise RuntimeError(f"Config file not found: {self.path}")
        if self._cached is None or mtime > self._cached_mtime:
            with self._lock:
                mtime = self.path.stat().st_mtime
                if self._cached is None or mtime > self._cached_mtime:
                    self._cached = self._load()
                    self._cached_mtime = mtime
        return self._cached

    def _load(self) -> AppConfig:
        with self.path.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        return AppConfig(**data)

    def update(self, cfg: AppConfig) -> None:
        with self._lock:
            with self.path.open("w", encoding="utf-8") as f:
                yaml.safe_dump(cfg.model_dump(), f, allow_unicode=True, sort_keys=False)
            self._cached = cfg
            self._cached_mtime = self.path.stat().st_mtime


config_manager = ConfigManager(CONFIG_PATH)