from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import db
from app.routers import watchlist, market

app = FastAPI(title="Groww Signal API")

# Allowed frontend origins
origins = [
    "http://localhost:5173",                      # Local Vite development
    "https://growwsignal.vercel.app",      # Production deployment
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://growwsignal.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(watchlist.router)
app.include_router(market.router)


@app.get("/")
def root():
    return {
        "message": "Groww Signal API is running",
        "status": "ok"
    }


@app.get("/health")
def health_check():
    try:
        db.command("ping")
        return {
            "status": "ok",
            "db": "connected"
        }
    except Exception as e:
        return {
            "status": "error",
            "detail": str(e)
        }