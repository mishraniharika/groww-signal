import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  YAxis,
  XAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import {
  Home,
  List,
  Compass,
  Bell,
  BarChart2,
  Newspaper,
  Settings,
  Search,
} from "lucide-react";

import {
  getWatchlists,
  createWatchlist,
  addSymbol,
  removeSymbol,
  getAttention,
  markSeen,
  getAssetDetail,
  setSimulateFailure,
  getSimulateFailure,
} from "./api";

const USER_ID = "demo_user";

const NAV_ITEMS = [
  "Home",
  "Watchlists",
  "Explore",
  "Alerts",
  "Insights",
  "News",
  "Settings",
];

const NAV_ICON_MAP = {
  Home: Home,
  Watchlists: List,
  Explore: Compass,
  Alerts: Bell,
  Insights: BarChart2,
  News: Newspaper,
  Settings: Settings,
};

const LEVEL_META = {
  high: { impact: "High Impact", badgeClass: "high" },
  notable: { impact: "Notable", badgeClass: "medium" },
  routine: { impact: null, badgeClass: "" },
};

function formatRelativeTime(date) {
  if (!date) return null;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function Logo() {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #4F6EF7, #00D09C)",
        flexShrink: 0,
      }}
    />
  );
}

function NavIcon({ name }) {
  const Icon = NAV_ICON_MAP[name] || Home;
  return <Icon size={16} strokeWidth={2} />;
}

/* Data quality badge */
function DataQualityBadge({ quality }) {
  if (!quality || quality === "fresh") return null;

  const styles = {
    stale: {
      label: "Stale data",
      className: "badge-stale",
    },
    unavailable: {
      label: "Unavailable",
      className: "badge-unavailable",
    },
  };

  const cfg = styles[quality] || {
    label: quality,
    className: "badge-stale",
  };

  return (
    <span className={`data-quality-badge ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function AssetDetail({ symbol, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    getAssetDetail(symbol)
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load asset detail:", err);
        setData(null);
        setLoading(false);
      });
  }, [symbol]);

  if (loading) {
    return <div className="detail-loading">Loading {symbol}…</div>;
  }

  if (!data) {
    return (
      <div>
        <button className="back-link" onClick={onBack}>
          ← Back
        </button>
        <p>Could not load asset detail.</p>
      </div>
    );
  }

  const { quote = {}, unusualness, events = [] } = data;

  const isUnavailable =
    quote?.data_quality === "unavailable" || quote?.price == null;

  if (isUnavailable) {
    return (
      <div className="asset-detail">
        <button className="back-link" onClick={onBack}>
          ← Back
        </button>

        <div className="detail-unavailable-state">
          <div className="detail-unavailable-icon">!</div>
          <h1>Stock not found</h1>
          <p>
            We couldn't find a stock matching <strong>"{symbol}"</strong>.
          </p>
          <p className="muted">
            Please check the company name or ticker symbol and try again.
          </p>
        </div>
      </div>
    );
  }

  const displaySymbol = data.symbol || symbol;

  return (
    <div className="asset-detail">
      <button className="back-link" onClick={onBack}>
        ← Back
      </button>

      <div className="detail-header">
        <div
          className="change-logo"
          style={{ width: 44, height: 44, fontSize: 15 }}
        >
          {displaySymbol.slice(0, 2)}
        </div>
        <div>
          <h1>{displaySymbol}</h1>
          <p className="detail-exchange">NSE</p>
        </div>
      </div>

      <div className="detail-price-row">
        <span className="detail-price">₹{quote.price}</span>

        <span className={quote.pct_change >= 0 ? "positive" : "negative"}>
          {quote.pct_change}%
        </span>

        <DataQualityBadge quality={quote.data_quality} />
      </div>

      <PriceHistoryChart history={data.history} up={quote.pct_change >= 0} />

      {unusualness && !unusualness.error && (
        <div
          className={`evidence-box ${
            unusualness.is_unusual ? "evidence-highlight" : ""
          }`}
        >
          <h3>Why this matters</h3>
          <p>
            This move is{" "}
            <strong>{unusualness.multiple_of_normal}×</strong> the stock's
            typical daily movement ({unusualness.avg_daily_move_pct}% average
            over 30 days).
            {unusualness.is_unusual
              ? " This is significantly more than usual — worth a closer look."
              : " This is within the asset's normal range."}
          </p>
        </div>
      )}

      <h3>Recent Timeline</h3>

      <div className="event-timeline">
        {events.length === 0 && (
          <p className="muted">No recent news events found.</p>
        )}

        {events.map((event, index) => (
          <a
            key={index}
            href={event.link}
            target="_blank"
            rel="noreferrer"
            className="timeline-item"
          >
            <div className="timeline-dot" />
            <div>
              <p className="timeline-title">{event.title}</p>
              <p className="timeline-meta">{event.publisher}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function Sparkline({ symbol, up }) {
  const seed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

  const points = Array.from({ length: 8 }, (_, i) => {
    const variance = ((seed * (i + 1)) % 17) - 8;
    const trend = up ? i * 1.5 : -i * 1.5;
    return Math.max(2, Math.min(38, 20 - trend - variance * 0.4));
  });

  const path = points.map((y, i) => `${i * 10},${y}`).join(" ");

  return (
    <svg width="70" height="40" style={{ flexShrink: 0 }}>
      <polyline
        points={path}
        fill="none"
        stroke={up ? "#00D09C" : "#EB5757"}
        strokeWidth="2"
      />
    </svg>
  );
}

function PriceHistoryChart({ history, up }) {
  if (!history || history.length === 0) {
    return (
      <div className="price-history-card">
        <div className="price-history-empty">
          No historical price data available.
        </div>
      </div>
    );
  }

  const color = up ? "#00D09C" : "#EB5757";

  const firstPrice = Number(history[0].close);
  const currentPrice = Number(history[history.length - 1].close);

  const performance =
    firstPrice > 0 ? ((currentPrice - firstPrice) / firstPrice) * 100 : 0;

  const chartData = history.map((item) => ({
    date: item.date,
    price: Number(item.close),
  }));

  const minPrice = Math.min(...chartData.map((item) => item.price));
  const maxPrice = Math.max(...chartData.map((item) => item.price));
  const padding = Math.max((maxPrice - minPrice) * 0.15, 5);

  const formatDate = (date) => {
    const parsed = new Date(date);
    return parsed.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  };

  const formatPrice = (value) =>
    `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-date">{formatDate(label)}</div>
        <div className="chart-tooltip-price">
          {formatPrice(payload[0].value)}
        </div>
      </div>
    );
  };

  return (
    <div className="price-history-card">
      <div className="price-history-header">
        <div>
          <h3>1 Month Price History</h3>
          <p>{history.length} trading days</p>
        </div>

        <div
          className={`price-history-performance ${
            performance >= 0 ? "positive" : "negative"
          }`}
        >
          {performance >= 0 ? "+" : ""}
          {performance.toFixed(2)}%
        </div>
      </div>

      <div className="price-history-chart">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 8, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient id="priceAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F6" />

            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tickLine={false}
              axisLine={false}
              minTickGap={32}
              tick={{ fontSize: 11, fill: "#6B7686" }}
            />

            <YAxis
              domain={[minPrice - padding, maxPrice + padding]}
              tickFormatter={formatPrice}
              tickLine={false}
              axisLine={false}
              width={70}
              tick={{ fontSize: 11, fill: "#6B7686" }}
            />

            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="price"
              stroke={color}
              strokeWidth={2.5}
              fill="url(#priceAreaGradient)"
              dot={false}
              activeDot={{ r: 5, fill: color, stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="price-history-footer">
        <span>
          <span className="footer-label">Start</span> {formatPrice(firstPrice)}
        </span>
        <span className="footer-divider" />
        <span>
          <span className="footer-label">Current</span>{" "}
          {formatPrice(currentPrice)}
        </span>
        <span className="footer-divider" />
        <span className={up ? "positive" : "negative"}>
          {up ? "Up over the latest session" : "Down over the latest session"}
        </span>
      </div>
    </div>
  );
}

function WatchlistsView({
  items,
  attentionData,
  onAdd,
  onRemove,
  symbolInput,
  setSymbolInput,
  onSelect,
}) {
  return (
    <div>
      <div className="page-header-row">
        <h3 className="section-title" style={{ margin: 0 }}>
          Your Watchlist
        </h3>

        <form className="quick-add" onSubmit={onAdd}>
          <input
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value)}
            placeholder="e.g. RELIANCE"
          />
          <button type="submit">+ Add</button>
        </form>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <h3>No stocks tracked yet</h3>
          <p>Add a symbol above to start tracking it.</p>
        </div>
      ) : (
        <table className="wl-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Price</th>
              <th>Change</th>
              <th>Attention</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {items.map((item) => {
              const data = attentionData[item.symbol];
              const level = data?.attention || "routine";
              const change = data?.quote?.pct_change;
              const up = change != null && change >= 0;

              return (
                <tr key={item.symbol}>
                  <td>
                    <div
                      className="wl-symbol-cell clickable-stock"
                      onClick={() => onSelect(item.symbol)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelect(item.symbol);
                        }
                      }}
                      title={`View ${item.symbol} details`}
                    >
                      <div
                        className="change-logo"
                        style={{ width: 28, height: 28, fontSize: 11 }}
                      >
                        {item.symbol.slice(0, 2)}
                      </div>
                      {item.symbol}
                    </div>
                  </td>

                  <td className="mono-num">
                    <span>₹{data?.quote?.price ?? "—"}</span>
                    <DataQualityBadge quality={data?.quote?.data_quality} />
                  </td>

                  <td
                    className="mono-num"
                    style={{
                      color:
                        change == null
                          ? "var(--text-muted)"
                          : up
                          ? "var(--green-dark)"
                          : "var(--red)",
                    }}
                  >
                    {change != null ? `${up ? "+" : ""}${change}%` : "—"}
                  </td>

                  <td>
                    <span className={`wl-level-pill ${level}`}>{level}</span>
                  </td>

                  <td>
                    <div className="wl-actions">
                      <button
                        className="wl-details-btn"
                        onClick={() => onSelect(item.symbol)}
                      >
                        View Details
                      </button>
                      <button
                        className="wl-remove-btn"
                        onClick={() => onRemove(item.symbol)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function App() {
  const [activeNav, setActiveNav] = useState("Home");
  const [watchlist, setWatchlist] = useState(null);
  const [symbolInput, setSymbolInput] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [attentionData, setAttentionData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [failureMode, setFailureMode] = useState(false);

  // --- Last-updated timestamp ---
  const [lastUpdated, setLastUpdated] = useState(null);
  const [, forceTick] = useState(0);

  // --- Toast notifications ---
  const [toast, setToast] = useState(null);

  // --- Notification bell dropdown ---
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  // Ticks once a second purely so the "Xs ago" label stays live.
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Closes the notification dropdown when clicking anywhere outside it.
  useEffect(() => {
    if (!showNotifications) return;

    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifications]);

  const loadWatchlist = useCallback(async () => {
    try {
      const lists = await getWatchlists(USER_ID);
      if (lists.length > 0) {
        setWatchlist(lists[0]);
      } else {
        setWatchlist(await createWatchlist(USER_ID));
      }
    } catch (err) {
      console.error("Failed to load watchlist:", err);
      setError("Could not connect to backend. Is uvicorn running on port 8000?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  const refreshAttention = useCallback(async () => {
  if (!watchlist?.items?.length) return;

  const results = {};

  const requests = watchlist.items.map(async (item) => {
    try {
      const attention = await getAttention(USER_ID, item.symbol);
      return {
        symbol: item.symbol,
        attention,
      };
    } catch (err) {
      console.error(`Failed to fetch attention for ${item.symbol}:`, err);
      return {
        symbol: item.symbol,
        attention: null,
      };
    }
  });

  const settledResults = await Promise.all(requests);

  settledResults.forEach(({ symbol, attention }) => {
    if (attention !== null) {
      results[symbol] = attention;
    }
  });

  setAttentionData(results);
  setLastUpdated(new Date());
}, [watchlist]);

  useEffect(() => {
    refreshAttention();
  }, [refreshAttention]);

  useEffect(() => {
    getSimulateFailure()
      .then((data) => setFailureMode(data.enabled))
      .catch((err) => console.error("Failed to get failure mode:", err));
  }, []);

  const toggleFailureMode = async () => {
    try {
      const next = !failureMode;
      await setSimulateFailure(next);
      setFailureMode(next);
      await refreshAttention();
    } catch (err) {
      console.error("Failed to toggle failure mode:", err);
      setError("Failed to toggle data outage simulation.");
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!symbolInput.trim() || !watchlist?._id) return;

    const symbol = symbolInput.trim().toUpperCase();
    const formatted = symbol.includes(".") ? symbol : `${symbol}.NS`;

    try {
      await addSymbol(watchlist._id, formatted);
      setSymbolInput("");
      setShowQuickAdd(false);
      const lists = await getWatchlists(USER_ID);
      setWatchlist(lists[0]);
      showToast(`Added ${formatted} to your watchlist`);
    } catch (err) {
      console.error("Add failed:", err);
      setError("Failed to add symbol — check console for details.");
    }
  };

  const handleRemove = async (symbol) => {
    await removeSymbol(watchlist._id, symbol);
    const lists = await getWatchlists(USER_ID);
    setWatchlist(lists[0]);
    showToast(`Removed ${symbol} from your watchlist`);
  };

  const handleMarkSeen = async (symbol) => {
    await markSeen(USER_ID, symbol);
    refreshAttention();
  };

  const handleSearch = () => {
    const query = searchQuery.trim().toUpperCase();
    if (!query) return;
    const formatted = query.includes(".") ? query : `${query}.NS`;
    setSelectedSymbol(formatted);
    setSearchQuery("");
  };

  const items = watchlist?.items || [];

  const withData = useMemo(
    () =>
      items
        .filter((i) => attentionData[i.symbol])
        .map((i) => ({ ...i, data: attentionData[i.symbol] })),
    [items, attentionData]
  );

  const meaningful = withData.filter((i) =>
    ["high", "notable"].includes(i.data.attention)
  );

  const gainers = meaningful.filter(
    (i) => (i.data.quote?.pct_change ?? 0) >= 0
  ).length;

  const losers = meaningful.length - gainers;

  const highImpact = withData.filter((i) => i.data.attention === "high");

  const dataIssues = withData.filter(
    (i) =>
      i.data.quote?.data_quality === "stale" ||
      i.data.quote?.data_quality === "unavailable"
  );

  const filtered = meaningful.filter((i) => {
    if (filter === "all") return true;
    if (filter === "high") return i.data.attention === "high";
    if (filter === "gainers") return (i.data.quote?.pct_change ?? 0) >= 0;
    if (filter === "losers") return (i.data.quote?.pct_change ?? 0) < 0;
    return true;
  });

  if (loading) {
    return <div className="loading-shell">Loading watchlist…</div>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sb-brand">
          <Logo />
          <span className="brand sb-brand-name">
            Groww
            <br />
            Signal
          </span>
        </div>

        <nav className="sb-nav">
          {NAV_ITEMS.map((name) => (
            <button
              key={name}
              className={`nav-item${activeNav === name ? " active" : ""}`}
              onClick={() => {
                setActiveNav(name);
                setSelectedSymbol(null);
              }}
            >
              <NavIcon name={name} />
              {name}
            </button>
          ))}
        </nav>

        <div className="sb-footer">
          <div className="market-status">
            <span className="dot-live" />
            Market is Open
          </div>

          <div className="user-row">
            <div className="avatar" />
            <div>
              <div className="user-name">Ananya</div>
              <div className="user-plan">Premium</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <div className="search-box">
            <Search size={15} color="var(--text-muted)" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              placeholder="Search for stocks, ETFs, indices…"
            />
          </div>

          <div className="topbar-right">
            <span className="index-pill up">
              <b>NIFTY 24,831.95</b>
              +0.72%
            </span>
            <span className="index-pill up">
              <b>SENSEX 81,330.83</b>
              +0.67%
            </span>

            <div className="notif-wrapper" ref={notifRef}>
              <button
                className="icon-btn"
                onClick={() => setShowNotifications((s) => !s)}
              >
                <Bell size={16} />
                {highImpact.length > 0 && <span className="notif-dot" />}
              </button>

              {showNotifications && (
                <div className="notif-dropdown">
                  <div className="notif-dropdown-header">
                    High impact changes
                  </div>

                  {highImpact.length === 0 ? (
                    <div className="notif-empty">
                      No high impact events right now.
                    </div>
                  ) : (
                    highImpact.map((i) => (
                      <div
                        key={i.symbol}
                        className="notif-item"
                        onClick={() => {
                          setSelectedSymbol(i.symbol);
                          setShowNotifications(false);
                        }}
                      >
                        <span className="notif-symbol">{i.symbol}</span>
                        <span className="notif-reason">
                          {i.data.reasons?.[0] || "Meaningful change detected"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {error && <div className="error-banner">{error}</div>}

        <main className="content">
          {selectedSymbol ? (
            <AssetDetail
              symbol={selectedSymbol}
              onBack={() => setSelectedSymbol(null)}
            />
          ) : activeNav === "Watchlists" ? (
            <WatchlistsView
              items={items}
              attentionData={attentionData}
              onAdd={handleAdd}
              onRemove={handleRemove}
              symbolInput={symbolInput}
              setSymbolInput={setSymbolInput}
              onSelect={setSelectedSymbol}
            />
          ) : activeNav !== "Home" ? (
            <div className="placeholder-view">
              <h3 style={{ color: "var(--text)", marginBottom: 6 }}>
                {activeNav}
              </h3>
              <p>This view isn't built yet — happy to do it next.</p>
            </div>
          ) : (
            <>
              <div className="hero">
                <div className="hero-blob" />
                <h2 className="hero-title">While you were away</h2>
                <p className="hero-sub">
                  Here's what changed since your last visit.
                </p>

                <button
                  className={`outage-toggle ${failureMode ? "active" : ""}`}
                  onClick={toggleFailureMode}
                >
                  {failureMode
                    ? "🔴 Live data OFF — showing cached fallback"
                    : "⚡ Simulate Data Outage"}
                </button>

                {lastUpdated && (
                  <span className="last-updated-label">
                    Updated {formatRelativeTime(lastUpdated)}
                  </span>
                )}

                <div className="stat-grid">
                  <div className="stat-tile" style={{ "--tile-color": "#00D09C" }}>
                    <div className="num mono-num">{meaningful.length}</div>
                    <div className="label">Meaningful changes</div>
                    <div className="meta">
                      ▲ {gainers} gainers · ▼ {losers} losers
                    </div>
                  </div>

                  <div
                    className="stat-tile disabled"
                    style={{ "--tile-color": "#4F6EF7" }}
                  >
                    <div className="num mono-num">—</div>
                    <div className="label">New 52W Highs</div>
                    <div className="meta">Coming soon</div>
                  </div>

                  <div className="stat-tile" style={{ "--tile-color": "#F5A623" }}>
                    <div className="num mono-num">{highImpact.length}</div>
                    <div className="label">High impact events</div>
                    <div className="meta">Price + volume confirmed</div>
                  </div>

                  <div className="stat-tile" style={{ "--tile-color": "#7B68EE" }}>
                    <div className="num mono-num">{dataIssues.length}</div>
                    <div className="label">Data issues detected</div>
                    <div className="meta">
                      Stale feed for {dataIssues.length} asset(s)
                    </div>
                  </div>
                </div>
              </div>

              <div className="page-header-row">
                <h3 className="section-title" style={{ margin: 0 }}>
                  Meaningful changes
                </h3>

                {showQuickAdd ? (
                  <form className="quick-add" onSubmit={handleAdd}>
                    <input
                      autoFocus
                      value={symbolInput}
                      onChange={(e) => setSymbolInput(e.target.value)}
                      placeholder="e.g. RELIANCE"
                    />
                    <button type="submit">Add</button>
                  </form>
                ) : (
                  <button
                    className="view-all-btn"
                    style={{ margin: 0 }}
                    onClick={() => setShowQuickAdd(true)}
                  >
                    + Add symbol
                  </button>
                )}
              </div>

              <div className="chip-row">
                <span
                  className={`chip${filter === "all" ? " active" : ""}`}
                  onClick={() => setFilter("all")}
                  style={{ cursor: "pointer" }}
                >
                  All ({meaningful.length})
                </span>

                <span
                  className={`chip${filter === "gainers" ? " active" : ""}`}
                  onClick={() => setFilter("gainers")}
                  style={{ cursor: "pointer" }}
                >
                  Gainers ({gainers})
                </span>

                <span
                  className={`chip${filter === "losers" ? " active" : ""}`}
                  onClick={() => setFilter("losers")}
                  style={{ cursor: "pointer" }}
                >
                  Losers ({losers})
                </span>

                <span
                  className={`chip${filter === "high" ? " active" : ""}`}
                  onClick={() => setFilter("high")}
                  style={{ cursor: "pointer" }}
                >
                  High Impact ({highImpact.length})
                </span>

                <span className="sort-label">
                  Sort by: <b>Impact</b>
                </span>
              </div>

              {items.length === 0 ? (
                <div className="empty-state">
                  <h3>Nothing to watch yet</h3>
                  <p>Add a symbol above to start tracking meaningful changes.</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="empty-state">
                  <h3>Nothing major changed since you last checked</h3>
                  <p>You're all caught up.</p>
                </div>
              ) : (
                filtered.map(({ symbol, data }) => {
                  const meta = LEVEL_META[data.attention] || LEVEL_META.routine;
                  const change = data.quote?.pct_change;
                  const up = change != null && change >= 0;

                  return (
                    <div key={symbol} className="change-row">
                      <div
                        className="change-logo clickable-stock"
                        onClick={() => setSelectedSymbol(symbol)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedSymbol(symbol);
                          }
                        }}
                        title={`View ${symbol} details`}
                      >
                        {symbol.slice(0, 2)}
                      </div>

                      <div
                        className="change-name clickable-stock"
                        onClick={() => setSelectedSymbol(symbol)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedSymbol(symbol);
                          }
                        }}
                        title={`View ${symbol} details`}
                      >
                        <div className="change-symbol">{symbol}</div>
                        <button
                          className="stock-update-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSymbol(symbol);
                          }}
                        >
                          View details
                        </button>
                      </div>

                      <Sparkline symbol={symbol} up={up} />

                      <div className="change-price">
                        <span className="num mono-num">
                          ₹{data.quote?.price ?? "—"}
                        </span>
                        <DataQualityBadge quality={data.quote?.data_quality} />
                        {change != null && (
                          <span
                            className="pct mono-num"
                            style={{ color: up ? "#00D09C" : "#EB5757" }}
                          >
                            {up ? "+" : ""}
                            {change}%
                          </span>
                        )}
                      </div>

                      <div className="change-impact">
                        {meta.impact && (
                          <span className={`impact-badge ${meta.badgeClass}`}>
                            {meta.impact}
                          </span>
                        )}
                      </div>

                      <div className="change-why">
                        <span className="why-label">Why is this meaningful?</span>
                        <span className="why-reasons">
                          {data.reasons?.join(" · ") || "—"}
                        </span>
                      </div>

                      <button
                        className="change-remove"
                        onClick={() => handleRemove(symbol)}
                        title="Remove from watchlist"
                      >
                        ×
                      </button>

                      <button
                        className="change-chevron"
                        onClick={() => handleMarkSeen(symbol)}
                        title="Mark as seen"
                      >
                        ✓
                      </button>
                    </div>
                  );
                })
              )}

              {filtered.length > 0 && (
                <button className="view-all-btn">View all changes →</button>
              )}
            </>
          )}
        </main>
      </div>

      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}
    </div>
  );
}
