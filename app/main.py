from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import config as config_route, quest as quest_route, image as image_route

app = FastAPI(title="QuestForge API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(config_route.router)
app.include_router(quest_route.router)
app.include_router(image_route.router)


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok"}