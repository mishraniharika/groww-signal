def classify_attention(changes: dict, context: dict | None = None) -> dict:
    """
    Takes change-detection output (+ optional sector/index context)
    and returns an attention level with explicit reasons.
    Deterministic rules only — no black-box score.
    """
    if changes.get("is_first_view"):
        return {"attention": "routine", "reasons": ["First time this stock is being tracked."]}

    reasons = []
    price_delta = changes.get("price_delta_pct")
    volume_ratio = changes.get("volume_ratio")

    if price_delta is not None and abs(price_delta) >= 3:
        reasons.append(f"Price moved {price_delta}% since last checked.")
    if volume_ratio is not None and volume_ratio >= 1.8:
        reasons.append(f"Volume is {volume_ratio}x the last recorded volume.")
    if context and context.get("nifty_pct_change") is not None and price_delta is not None:
        nifty_change = context["nifty_pct_change"]
        if abs(price_delta - nifty_change) >= 2:
            reasons.append(f"Stock moved {price_delta}% vs Nifty's {nifty_change}% — diverging from the market.")

    if len(reasons) >= 2:
        attention = "high"
    elif len(reasons) == 1:
        attention = "notable"
    else:
        attention = "routine"
        reasons.append("Movement within normal range, nothing unusual detected.")

    return {"attention": attention, "reasons": reasons}