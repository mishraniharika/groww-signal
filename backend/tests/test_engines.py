from app.services.change_detection import detect_changes
from app.services.meaningfulness import classify_attention


# -------------------------
# Change Detection tests
# -------------------------

def test_detect_changes_first_view():
    result = detect_changes(
        None,
        {"price": 2500, "volume": 100000},
    )

    assert result["is_first_view"] is True
    assert result["price_delta_pct"] is None
    assert result["volume_ratio"] is None


def test_detect_changes_price_and_volume():
    result = detect_changes(
        {"price": 100, "volume": 1000},
        {"price": 105, "volume": 2000},
    )

    assert result["is_first_view"] is False
    assert result["price_delta_pct"] == 5.0
    assert result["volume_ratio"] == 2.0
    assert result["last_seen_price"] == 100
    assert result["current_price"] == 105


def test_detect_changes_price_drop():
    result = detect_changes(
        {"price": 200, "volume": 1000},
        {"price": 190, "volume": 1000},
    )

    assert result["price_delta_pct"] == -5.0


def test_detect_changes_zero_previous_volume():
    result = detect_changes(
        {"price": 100, "volume": 0},
        {"price": 105, "volume": 2000},
    )

    assert result["volume_ratio"] is None


def test_detect_changes_missing_values():
    result = detect_changes(
        {"price": None, "volume": None},
        {"price": 100, "volume": 2000},
    )

    assert result["price_delta_pct"] is None
    assert result["volume_ratio"] is None


# -------------------------
# Meaningfulness tests
# -------------------------

def test_classify_attention_first_view():
    result = classify_attention(
        {
            "is_first_view": True,
            "price_delta_pct": None,
            "volume_ratio": None,
        }
    )

    assert result["attention"] == "routine"
    assert "First time this stock is being tracked." in result["reasons"]


def test_classify_attention_routine():
    result = classify_attention(
        {
            "is_first_view": False,
            "price_delta_pct": 1.0,
            "volume_ratio": 1.2,
        }
    )

    assert result["attention"] == "routine"
    assert "Movement within normal range, nothing unusual detected." in result["reasons"]


def test_classify_attention_notable_price_move():
    result = classify_attention(
        {
            "is_first_view": False,
            "price_delta_pct": 4.0,
            "volume_ratio": 1.0,
        }
    )

    assert result["attention"] == "notable"
    assert "Price moved 4.0% since last checked." in result["reasons"]


def test_classify_attention_notable_volume():
    result = classify_attention(
        {
            "is_first_view": False,
            "price_delta_pct": 1.0,
            "volume_ratio": 2.0,
        }
    )

    assert result["attention"] == "notable"
    assert "Volume is 2.0x the last recorded volume." in result["reasons"]


def test_classify_attention_high_multiple_signals():
    result = classify_attention(
        {
            "is_first_view": False,
            "price_delta_pct": 4.0,
            "volume_ratio": 2.0,
        }
    )

    assert result["attention"] == "high"
    assert len(result["reasons"]) == 2


def test_classify_attention_market_divergence():
    result = classify_attention(
        {
            "is_first_view": False,
            "price_delta_pct": 4.0,
            "volume_ratio": 1.0,
        },
        {
            "nifty_pct_change": 1.0,
        },
    )

    assert result["attention"] == "high"
    assert len(result["reasons"]) == 2
    assert any("diverging from the market" in reason for reason in result["reasons"])