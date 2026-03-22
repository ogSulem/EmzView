from fastapi import FastAPI

from app.routers.recommend import router as recommend_router

app = FastAPI(title="EMZ ML Service", version="1.0.0")


@app.get("/health")
def health():
    return {"ok": True}


app.include_router(recommend_router, prefix="/recommend", tags=["recommend"])
