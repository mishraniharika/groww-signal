from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class WatchlistItem(BaseModel):
    symbol: str          # e.g. "RELIANCE.NS"
    added_at: datetime = Field(default_factory=datetime.utcnow)

class Watchlist(BaseModel):
    user_id: str
    name: str = "My Watchlist"
    items: List[WatchlistItem] = []

class WatchlistCreate(BaseModel):
    user_id: str
    name: str = "My Watchlist"

class AddSymbolRequest(BaseModel):
    symbol: str