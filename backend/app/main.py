from fastapi import FastAPI
from app.database import db
from app.routers import watchlist

app = FastAPI(title="Groww Signal API")

app.include_router(watchlist.router)

@app.get("/health")
def health_check():
    try:
        db.command("ping")
        return {"status": "ok", "db": "connected"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}