from fastapi import APIRouter
from pydantic import BaseModel
import yfinance as yf
from datetime import datetime, timezone

from app.services.market_data import (
    fetch_quote,
    fetch_sector_and_index,
    resolve_symbol,
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


# ---------------------------------------------------------
# ASSET DETAIL
# ---------------------------------------------------------

@router.get("/asset-detail/{symbol}")
def get_asset_detail(symbol: str):
    """
    Combines current quote, unusualness-vs-own-history, real price history,
    and recent news into one payload for the Asset Detail page.
    """

    # Resolve company name / old ticker to the current Yahoo Finance ticker.
    # Example:
    # ZOMATO     -> ETERNAL.NS
    # ZOMATO.NS  -> ETERNAL.NS
    # ETERNAL    -> ETERNAL.NS
    resolved_symbol = resolve_symbol(symbol)

    quote = fetch_quote(symbol)

    # Default to an empty history so the endpoint remains safe if
    # historical market data cannot be fetched.
    history_points = []

    # --- Unusualness: compare today's move to the asset's own recent volatility ---
    unusualness = None

    try:
        ticker = yf.Ticker(resolved_symbol)
        hist = ticker.history(period="1mo")

        if not hist.empty and len(hist) > 5:
            daily_pct_moves = hist["Close"].pct_change().dropna() * 100

            # Build real historical closing-price points for the frontend chart.
            history_points = [
                {
                    "date": str(idx.date()),
                    "close": round(float(row), 2),
                }
                for idx, row in hist["Close"].items()
            ]

            # Convert NumPy numeric values into normal Python floats
            # so FastAPI can serialize them safely as JSON.
            avg_move = float(
                round(daily_pct_moves.abs().mean(), 2)
            )

            std_move = float(
                round(daily_pct_moves.std(), 2)
            )

            today_move = quote.get("pct_change")

            if today_move is not None and avg_move > 0:
                multiple = round(
                    abs(today_move) / avg_move,
                    1
                )

                unusualness = {
                    "avg_daily_move_pct": avg_move,
                    "std_dev_pct": std_move,
                    "today_move_pct": today_move,
                    "multiple_of_normal": multiple,

                    # Convert NumPy/Python comparison result
                    # explicitly to a normal Python bool.
                    "is_unusual": bool(multiple >= 2.0),
                }

    except Exception as e:
        unusualness = {
            "error": f"Could not compute unusualness: {str(e)}"
        }

    # --- Recent news events, for the timeline ---
    events = []

    try:
        # IMPORTANT:
        # Use the resolved Yahoo Finance ticker here.
        # This prevents ZOMATO from being queried as the old
        # ZOMATO ticker instead of the current ETERNAL ticker.
        ticker = yf.Ticker(resolved_symbol)

        news_items = ticker.news[:5] if ticker.news else []

        for item in news_items:
            content = item.get("content", item)

            events.append({
                "title": content.get("title", "Untitled"),
                "publisher": content.get("provider", {}).get(
                    "displayName",
                    "Unknown"
                ),
                "link": (
                    content.get("canonicalUrl", {}).get("url", "")
                    if isinstance(
                        content.get("canonicalUrl"),
                        dict
                    )
                    else content.get("link", "")
                ),
                "published_at": content.get(
                    "pubDate",
                    None
                ),
            })

    except Exception:
        # News is optional. If Yahoo Finance news fails,
        # the Asset Detail endpoint should still work.
        events = []

    return {
        # Return the resolved/current ticker so the frontend
        # knows which actual Yahoo Finance symbol was used.
        "symbol": resolved_symbol,
        "quote": quote,
        "unusualness": unusualness,
        "events": events,
        "history": history_points,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
