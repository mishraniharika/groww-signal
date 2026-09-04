from fastapi import APIRouter
from app.services.market_data import fetch_quote, fetch_sector_and_index

router = APIRouter(prefix="/market", tags=["market"])

@router.get("/quote/{symbol}")
def get_quote(symbol: str):
    return fetch_quote(symbol)

@router.get("/context/{symbol}")
def get_context(symbol: str):
    return fetch_sector_and_index(symbol)