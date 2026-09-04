from fastapi import APIRouter, HTTPException
from bson import ObjectId
from app.database import db
from app.models.watchlist import WatchlistCreate, AddSymbolRequest
from datetime import datetime

router = APIRouter(prefix="/watchlist", tags=["watchlist"])
collection = db["watchlists"]

def serialize(doc):
    doc["_id"] = str(doc["_id"])
    return doc

@router.post("/")
def create_watchlist(payload: WatchlistCreate):
    doc = {"user_id": payload.user_id, "name": payload.name, "items": []}
    result = collection.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc

@router.get("/user/{user_id}")
def get_watchlists(user_id: str):
    docs = list(collection.find({"user_id": user_id}))
    return [serialize(d) for d in docs]

@router.get("/{watchlist_id}")
def get_watchlist(watchlist_id: str):
    doc = collection.find_one({"_id": ObjectId(watchlist_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return serialize(doc)

@router.post("/{watchlist_id}/add")
def add_symbol(watchlist_id: str, payload: AddSymbolRequest):
    item = {"symbol": payload.symbol.upper(), "added_at": datetime.utcnow()}
    result = collection.update_one(
        {"_id": ObjectId(watchlist_id)},
        {"$addToSet": {"items": item}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return {"status": "added", "symbol": item["symbol"]}

@router.delete("/{watchlist_id}/remove/{symbol}")
def remove_symbol(watchlist_id: str, symbol: str):
    result = collection.update_one(
        {"_id": ObjectId(watchlist_id)},
        {"$pull": {"items": {"symbol": symbol.upper()}}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return {"status": "removed", "symbol": symbol.upper()}

@router.delete("/{watchlist_id}")
def delete_watchlist(watchlist_id: str):
    result = collection.delete_one({"_id": ObjectId(watchlist_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return {"status": "deleted"}