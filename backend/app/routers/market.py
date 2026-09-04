from fastapi import APIRouter
from app.services.market_data import fetch_quote, fetch_sector_and_index
from app.services.snapshot import get_last_snapshot, save_snapshot

router = APIRouter(prefix="/market", tags=["market"])

@router.get("/quote/{symbol}")
def get_quote(symbol: str):
    return fetch_quote(symbol)

@router.get("/context/{symbol}")
def get_context(symbol: str):
    return fetch_sector_and_index(symbol)

@router.post("/snapshot/{user_id}/{symbol}")
def mark_seen(user_id: str, symbol: str):
    quote = fetch_quote(symbol)
    save_snapshot(user_id, symbol, quote)
    return {"status": "snapshot saved", "quote": quote}

@router.get("/snapshot/{user_id}/{symbol}")
def get_snapshot(user_id: str, symbol: str):
    snap = get_last_snapshot(user_id, symbol)
    if not snap:
        return {"status": "no snapshot yet"}
    snap["_id"] = str(snap["_id"])
    return snap