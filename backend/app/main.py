from fastapi import FastAPI
from app.database import db
from app.routers import watchlist, market
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Groww Signal API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(watchlist.router)
app.include_router(market.router)

@app.get("/health")
def health_check():
    try:
        db.command("ping")
        return {"status": "ok", "db": "connected"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}