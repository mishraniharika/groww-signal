def detect_changes(last_snapshot: dict | None, current_quote: dict) -> dict:
    """
    Pure function: compares last snapshot to current quote.
    Returns a dict of raw signals — no judgment about 'meaningful' yet,
    that's the Meaningfulness Engine's job (next task).
    """
    if last_snapshot is None:
        return {
            "is_first_view": True,
            "price_delta_pct": None,
            "volume_ratio": None,
        }

    price_delta_pct = None
    if last_snapshot.get("price") and current_quote.get("price"):
        old_price = last_snapshot["price"]
        new_price = current_quote["price"]
        price_delta_pct = round(((new_price - old_price) / old_price) * 100, 2)

    volume_ratio = None
    if last_snapshot.get("volume") and current_quote.get("volume"):
        old_vol = last_snapshot["volume"]
        if old_vol > 0:
            volume_ratio = round(current_quote["volume"] / old_vol, 2)

    return {
        "is_first_view": False,
        "price_delta_pct": price_delta_pct,
        "volume_ratio": volume_ratio,
        "last_seen_price": last_snapshot.get("price"),
        "current_price": current_quote.get("price"),
    }