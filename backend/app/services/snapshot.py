from datetime import datetime, timezone
from app.database import db

snapshot_collection = db["snapshots"]

def get_last_snapshot(user_id: str, symbol: str) -> dict | None:
    return snapshot_collection.find_one({
        "user_id": user_id,
        "symbol": symbol.upper()
    })

def save_snapshot(user_id: str, symbol: str, quote: dict):
    """Overwrite the 'last seen' snapshot for this user+symbol with the current quote."""
    snapshot_collection.update_one(
        {"user_id": user_id, "symbol": symbol.upper()},
        {"$set": {
            "user_id": user_id,
            "symbol": symbol.upper(),
            "price": quote.get("price"),
            "volume": quote.get("volume"),
            "pct_change": quote.get("pct_change"),
            "seen_at": datetime.now(timezone.utc),
        }},
        upsert=True
    )