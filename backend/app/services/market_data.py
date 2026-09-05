import yfinance as yf
from datetime import datetime, timezone
from app.database import db

cache_collection = db["market_data_cache"]

# --- Demo-only failure simulation toggle ---
# Flipped live via POST /market/debug/simulate-failure so you can show the
# fallback path to judges without touching your network connection.
_simulate_failure = False


def set_simulate_failure(enabled: bool) -> bool:
    global _simulate_failure
    _simulate_failure = enabled
    return _simulate_failure


def get_simulate_failure() -> bool:
    return _simulate_failure


def fetch_quote(symbol: str) -> dict:
    """
    Fetch a normalized quote for a symbol (e.g. 'RELIANCE.NS').
    Falls back to last cached value if the live fetch fails, or if
    SIMULATE_FAILURE has been toggled on for demo purposes.
    """
    if _simulate_failure:
        return _fallback_to_cache(symbol, error="Simulated failure (SIMULATE_FAILURE=True)")

    try:
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info  # lightweight, avoids full .info() overhead

        price = info.get("lastPrice")
        prev_close = info.get("previousClose")
        volume = info.get("lastVolume")

        if price is None:
            raise ValueError("yfinance returned no price data")

        pct_change = None
        if prev_close and prev_close != 0:
            pct_change = round(((price - prev_close) / prev_close) * 100, 2)

        quote = {
            "symbol": symbol.upper(),
            "price": round(float(price), 2),
            "prev_close": round(float(prev_close), 2) if prev_close else None,
            "pct_change": pct_change,
            "volume": int(volume) if volume else None,
            "fetched_at": datetime.now(timezone.utc),
            "source": "yfinance",
            "stale": False,
            "data_quality": "fresh",
        }

        # cache it as the new "last known good"
        cache_collection.update_one(
            {"symbol": symbol.upper()},
            {"$set": quote},
            upsert=True
        )
        return quote

    except Exception as e:
        return _fallback_to_cache(symbol, error=str(e))


def _fallback_to_cache(symbol: str, error: str) -> dict:
    cached = cache_collection.find_one({"symbol": symbol.upper()})
    if cached:
        cached["_id"] = str(cached["_id"])
        cached["stale"] = True
        cached["fetch_error"] = error
        cached["data_quality"] = "stale"
        return cached
    # no cache exists at all — first-ever fetch failed
    return {
        "symbol": symbol.upper(),
        "price": None,
        "error": "No data available and no cached fallback exists",
        "fetch_error": error,
        "stale": True,
        "data_quality": "unavailable",
    }


def fetch_sector_and_index(symbol: str) -> dict:
    """
    Best-effort sector context. yfinance's sector data is inconsistent for
    NSE tickers, so this degrades gracefully instead of failing the whole request.
    """
    try:
        ticker = yf.Ticker(symbol)
        sector = ticker.info.get("sector", "Unknown")
    except Exception:
        sector = "Unknown"

    nifty = fetch_quote("^NSEI")
    return {"sector": sector, "nifty_pct_change": nifty.get("pct_change")}