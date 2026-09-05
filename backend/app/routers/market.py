from fastapi import APIRouter
from pydantic import BaseModel

from app.services.market_data import (
    fetch_quote,
    fetch_sector_and_index,
    set_simulate_failure,
    get_simulate_failure,
)

from app.services.snapshot import get_last_snapshot, save_snapshot
from app.services.change_detection import detect_changes
from app.services.meaningfulness import classify_attention


router = APIRouter(prefix="/market", tags=["market"])


class SimulateFailureRequest(BaseModel):
    enabled: bool


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

    return {
        "status": "snapshot saved",
        "quote": quote,
    }


@router.get("/snapshot/{user_id}/{symbol}")
def get_snapshot(user_id: str, symbol: str):
    snap = get_last_snapshot(user_id, symbol)

    if not snap:
        return {"status": "no snapshot yet"}

    snap["_id"] = str(snap["_id"])

    return snap


@router.get("/attention/{user_id}/{symbol}")
def get_attention(user_id: str, symbol: str):
    quote = fetch_quote(symbol)

    last_snapshot = get_last_snapshot(user_id, symbol)

    changes = detect_changes(
        last_snapshot,
        quote,
    )

    context = fetch_sector_and_index(symbol)

    result = classify_attention(
        changes,
        context,
    )

    return {
        "symbol": symbol.upper(),
        "quote": quote,
        "changes": changes,
        **result,
    }


# ---------------------------------------------------------
# DEMO / DEBUG — Simulate market-data failure
# ---------------------------------------------------------

@router.post("/debug/simulate-failure")
def toggle_simulate_failure(payload: SimulateFailureRequest):
    """
    DEMO ONLY.

    Turns simulated market-data failure on or off so the
    fallback / last-known-good cache behavior can be demonstrated
    without actually disconnecting the network.
    """
    new_state = set_simulate_failure(payload.enabled)

    return {
        "simulate_failure": new_state,
    }


@router.get("/debug/simulate-failure")
def read_simulate_failure():
    return {
        "simulate_failure": get_simulate_failure(),
    }