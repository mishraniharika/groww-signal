import yfinance as yf
from datetime import datetime, timezone

from app.database import db

cache_collection = db["market_data_cache"]


# --- Common company-name / ticker aliases ---
# Converts common user-entered names into the actual Yahoo Finance
# NSE ticker before making a request to yfinance.
COMMON_ALIASES = {
    "INFOSYS": "INFY.NS",
    "INFY": "INFY.NS",
    "TCS": "TCS.NS",
    "RELIANCE": "RELIANCE.NS",
    "RELIANCEINDUSTRIES": "RELIANCE.NS",
    "HDFC": "HDFCBANK.NS",
    "HDFCBANK": "HDFCBANK.NS",
    "ICICI": "ICICIBANK.NS",
    "ICICIBANK": "ICICIBANK.NS",
    "SBI": "SBIN.NS",
    "STATEBANK": "SBIN.NS",
    "WIPRO": "WIPRO.NS",
    "ITC": "ITC.NS",
    "LT": "LT.NS",
    "LARSEN": "LT.NS",
    "BAJAJFINANCE": "BAJFINANCE.NS",
    "BHARTIAIRTEL": "BHARTIARTL.NS",
    "AIRTEL": "BHARTIARTL.NS",
    "MARUTI": "MARUTI.NS",
    "TATASTEEL": "TATASTEEL.NS",
    "TATAMOTORS": "TATAMOTORS.NS",
    "ZOMATO": "ETERNAL.NS",
    "ETERNAL": "ETERNAL.NS",
    "ADANI": "ADANIENT.NS",
    "ADANIENTERPRISES": "ADANIENT.NS",
    "HINDUSTANUNILEVER": "HINDUNILVR.NS",
    "HUL": "HINDUNILVR.NS",
    "AXIS": "AXISBANK.NS",
    "AXISBANK": "AXISBANK.NS",
    "KOTAK": "KOTAKBANK.NS",
    "KOTAKBANK": "KOTAKBANK.NS",
    "NIFTY": "^NSEI",
    "SENSEX": "^BSESN",
}


def resolve_symbol(raw: str) -> str:
    """
    Converts common company names into their real Yahoo Finance ticker.

    Examples:
        INFOSYS      -> INFY.NS
        INFY         -> INFY.NS
        TCS          -> TCS.NS
        RELIANCE     -> RELIANCE.NS
        INFY.NS      -> INFY.NS
        ^NSEI        -> ^NSEI
        ZOMATO       -> ETERNAL.NS
        ZOMATO.NS    -> ETERNAL.NS
    """
    cleaned = raw.strip().upper().replace(" ", "")

    # Handle old/renamed ticker symbols first.
    # Zomato's old Yahoo Finance ticker was ZOMATO.NS;
    # the current ticker is ETERNAL.NS.
    if cleaned == "ZOMATO.NS":
        return "ETERNAL.NS"

    # Known company-name aliases
    if cleaned in COMMON_ALIASES:
        return COMMON_ALIASES[cleaned]

    # Already a Yahoo Finance NSE ticker or index symbol
    if cleaned.endswith(".NS") or cleaned.startswith("^"):
        return cleaned

    # Generic fallback for unknown Indian stock symbols
    return f"{cleaned}.NS"


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
    Fetch a normalized quote for a symbol.

    The symbol is first resolved through the alias system so that
    common company names such as INFOSYS are converted to the
    correct Yahoo Finance ticker (INFY.NS).

    Falls back to the last cached value if the live fetch fails,
    or if SIMULATE_FAILURE has been toggled on for demo purposes.
    """

    # Resolve company name / ticker before using yfinance or MongoDB.
    symbol = resolve_symbol(symbol)

    if _simulate_failure:
        return _fallback_to_cache(
            symbol,
            error="Simulated failure (SIMULATE_FAILURE=True)"
        )

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
            pct_change = round(
                ((price - prev_close) / prev_close) * 100,
                2
            )

        quote = {
            "symbol": symbol.upper(),
            "price": round(float(price), 2),
            "prev_close": (
                round(float(prev_close), 2)
                if prev_close
                else None
            ),
            "pct_change": pct_change,
            "volume": int(volume) if volume else None,
            "fetched_at": datetime.now(timezone.utc),
            "source": "yfinance",
            "stale": False,
            "data_quality": "fresh",
        }

        # Cache it as the new "last known good" value.
        cache_collection.update_one(
            {"symbol": symbol.upper()},
            {"$set": quote},
            upsert=True
        )

        return quote

    except Exception as e:
        return _fallback_to_cache(symbol, error=str(e))


def _fallback_to_cache(symbol: str, error: str) -> dict:
    """
    Return the most recent cached quote when live market data
    is unavailable.
    """

    cached = cache_collection.find_one(
        {"symbol": symbol.upper()}
    )

    if cached:
        cached["_id"] = str(cached["_id"])
        cached["stale"] = True
        cached["fetch_error"] = error
        cached["data_quality"] = "stale"
        return cached

    # No cache exists at all — first-ever fetch failed.
    return {
        "symbol": symbol.upper(),
        "price": None,
        "error": "Stock data unavailable. Please check the company name or ticker symbol.",
        "fetch_error": error,
        "stale": True,
        "data_quality": "unavailable",
    }


def fetch_sector_and_index(symbol: str) -> dict:
    """
    Best-effort sector context.

    yfinance's sector data is inconsistent for NSE tickers,
    so this degrades gracefully instead of failing the whole request.
    """

    # Resolve the symbol before asking yfinance for sector information.
    symbol = resolve_symbol(symbol)

    try:
        ticker = yf.Ticker(symbol)
        sector = ticker.info.get("sector", "Unknown")
    except Exception:
        sector = "Unknown"

    nifty = fetch_quote("^NSEI")

    return {
        "sector": sector,
        "nifty_pct_change": nifty.get("pct_change"),
    }