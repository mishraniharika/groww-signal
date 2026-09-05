import { useState, useEffect, useCallback, useMemo } from "react";
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

function DataQualityBadge({ quality }) {
  if (!quality || quality === "fresh") return null;

  const styles = {
    stale: { label: "Stale data", className: "badge-stale" },
    unavailable: { label: "Unavailable", className: "badge-unavailable" },
  };

  const cfg = styles[quality] || { label: quality, className: "badge-stale" };

  return <span className={`data-quality-badge ${cfg.className}`}>{cfg.label}</span>;
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
        <button className="back-link" onClick={onBack}>← Back</button>
        <p>Could not load asset detail.</p>
      </div>
    );
  }

  const { quote, unusualness, events } = data;

  return (
    <div className="asset-detail">
      <button className="back-link" onClick={onBack}>← Back</button>

      <div className="detail-header">
        <div className="change-logo" style={{ width: 44, height: 44, fontSize: 15 }}>
          {symbol.slice(0, 2)}
        </div>
        <div>
          <h1>{symbol}</h1>
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

      {unusualness && !unusualness.error && (
        <div className={`evidence-box ${unusualness.is_unusual ? "evidence-highlight" : ""}`}>
          <h3>Why this matters</h3>
          <p>
            This move is <strong>{unusualness.multiple_of_normal}×</strong> the stock's typical
            daily movement ({unusualness.avg_daily_move_pct}% average over 30 days).
            {unusualness.is_unusual
              ? " This is significantly more than usual — worth a closer look."
              : " This is within the asset's normal range."}
          </p>
        </div>
      )}

      <h3>Recent Timeline</h3>

      <div className="event-timeline">
        {events.length === 0 && <p className="muted">No recent news events found.</p>}

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
      <polyline points={path} fill="none" stroke={up ? "#00D09C" : "#EB5757"} strokeWidth="2" />
    </svg>
  );
}

function WatchlistsView({ items, attentionData, onAdd, onRemove, symbolInput, setSymbolInput, onSelect }) {
  return (
    <div>
      <div className="page-header-row">
        <h3 className="section-title" style={{ margin: 0 }}>Your Watchlist</h3>
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
              <th>Symbol</th><th>Price</th><th>Change</th><th>Attention</th><th></th>
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
                      <div className="change-logo" style={{ width: 28, height: 28, fontSize: 11 }}>
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
                      color: change == null ? "var(--text-muted)" : up ? "var(--green-dark)" : "var(--red)",
                    }}
                  >
                    {change != null ? `${up ? "+" : ""}${change}%` : "—"}
                  </td>
                  <td><span className={`wl-level-pill ${level}`}>{level}</span></td>
                  <td>
                    <div className="wl-actions">
                      <button className="wl-view-btn" onClick={() => onSelect(item.symbol)}>View Details</button>
                      <button className="wl-remove-btn" onClick={() => onRemove(item.symbol)}>Remove</button>
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

  useEffect(() => { loadWatchlist(); }, [loadWatchlist]);

  const refreshAttention = useCallback(async () => {
    if (!watchlist?.items?.length) return;
    const results = {};
    for (const item of watchlist.items) {
      try {
        results[item.symbol] = await getAttention(USER_ID, item.symbol);
      } catch (err) {
        console.error(`Failed to fetch attention for ${item.symbol}:`, err);
      }
    }
    setAttentionData(results);
  }, [watchlist]);

  useEffect(() => { refreshAttention(); }, [refreshAttention]);

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
    } catch (err) {
      console.error("Add failed:", err);
      setError("Failed to add symbol — check console for details.");
    }
  };

  const handleRemove = async (symbol) => {
    await removeSymbol(watchlist._id, symbol);
    const lists = await getWatchlists(USER_ID);
    setWatchlist(lists[0]);
  };

  const handleMarkSeen = async (symbol) => {
    await markSeen(USER_ID, symbol);
    refreshAttention();
  };

  const handleSearch = (e) => {
    if (e.key !== "Enter") return;
    const query = searchQuery.trim().toUpperCase();
    if (!query) return;
    const formatted = query.includes(".") ? query : `${query}.NS`;
    setSelectedSymbol(formatted);
    setSearchQuery("");
  };

  const items = watchlist?.items || [];

  const withData = useMemo(
    () => items.filter((i) => attentionData[i.symbol]).map((i) => ({ ...i, data: attentionData[i.symbol] })),
    [items, attentionData]
  );

  const meaningful = withData.filter((i) => ["high", "notable"].includes(i.data.attention));
  const gainers = meaningful.filter((i) => (i.data.quote?.pct_change ?? 0) >= 0).length;
  const losers = meaningful.length - gainers;
  const highImpact = withData.filter((i) => i.data.attention === "high");
  const dataIssues = withData.filter(
    (i) => i.data.quote?.data_quality === "stale" || i.data.quote?.data_quality === "unavailable"
  );

  const filtered = meaningful.filter((i) => {
    if (filter === "all") return true;
    if (filter === "high") return i.data.attention === "high";
    if (filter === "gainers") return (i.data.quote?.pct_change ?? 0) >= 0;
    if (filter === "losers") return (i.data.quote?.pct_change ?? 0) < 0;
    return true;
  });

  if (loading) return <div className="loading-shell">Loading watchlist…</div>;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sb-brand">
          <Logo />
          <span className="brand sb-brand-name">Groww<br />Signal</span>
        </div>

        <nav className="sb-nav">
          {NAV_ITEMS.map((name) => (
            <button
              key={name}
              className={`nav-item${activeNav === name ? " active" : ""}`}
              onClick={() => { setActiveNav(name); setSelectedSymbol(null); }}
            >
              <NavIcon name={name} />
              {name}
            </button>
          ))}
        </nav>

        <div className="sb-footer">
          <div className="market-status"><span className="dot-live" />Market is Open</div>
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
              onKeyDown={handleSearch}
              placeholder="Search for stocks, ETFs, indices…"
            />
          </div>
          <div className="topbar-right">
            <span className="index-pill up"><b>NIFTY 24,831.95</b>+0.72%</span>
            <span className="index-pill up"><b>SENSEX 81,330.83</b>+0.67%</span>
            <button className="icon-btn"><Bell size={16} /></button>
          </div>
        </header>

        {error && <div className="error-banner">{error}</div>}

        <main className="content">
          {selectedSymbol ? (
            <AssetDetail symbol={selectedSymbol} onBack={() => setSelectedSymbol(null)} />
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
              <h3 style={{ color: "var(--text)", marginBottom: 6 }}>{activeNav}</h3>
              <p>This view isn't built yet — happy to do it next.</p>
            </div>
          ) : (
            <>
              <div className="hero">
                <div className="hero-blob" />
                <h2 className="hero-title">While you were away</h2>
                <p className="hero-sub">Here's what changed since your last visit.</p>

                <div className="stat-grid">
                  <div className="stat-tile" style={{ "--tile-color": "#00D09C" }}>
                    <div className="num mono-num">{meaningful.length}</div>
                    <div className="label">Meaningful changes</div>
                    <div className="meta">▲ {gainers} gainers · ▼ {losers} losers</div>
                  </div>
                  <div className="stat-tile disabled" style={{ "--tile-color": "#4F6EF7" }}>
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
                    <div className="meta">Stale feed for {dataIssues.length} asset(s)</div>
                  </div>
                </div>
              </div>

              <div className="page-header-row">
                <h3 className="section-title" style={{ margin: 0 }}>Meaningful changes</h3>
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
                  <button className="view-all-btn" style={{ margin: 0 }} onClick={() => setShowQuickAdd(true)}>
                    + Add symbol
                  </button>
                )}
              </div>

              <div className="chip-row">
                <span className={`chip${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")} style={{ cursor: "pointer" }}>
                  All ({meaningful.length})
                </span>
                <span className={`chip${filter === "gainers" ? " active" : ""}`} onClick={() => setFilter("gainers")} style={{ cursor: "pointer" }}>
                  Gainers ({gainers})
                </span>
                <span className={`chip${filter === "losers" ? " active" : ""}`} onClick={() => setFilter("losers")} style={{ cursor: "pointer" }}>
                  Losers ({losers})
                </span>
                <span className={`chip${filter === "high" ? " active" : ""}`} onClick={() => setFilter("high")} style={{ cursor: "pointer" }}>
                  High Impact ({highImpact.length})
                </span>
                <span className="sort-label">Sort by: <b>Impact</b></span>
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
                          onClick={(e) => { e.stopPropagation(); setSelectedSymbol(symbol); }}
                        >
                          View details
                        </button>
                      </div>

                      <Sparkline symbol={symbol} up={up} />

                      <div className="change-price">
                        <span className="num mono-num">₹{data.quote?.price ?? "—"}</span>
                        <DataQualityBadge quality={data.quote?.data_quality} />
                        {change != null && (
                          <span className="pct mono-num" style={{ color: up ? "#00D09C" : "#EB5757" }}>
                            {up ? "+" : ""}{change}%
                          </span>
                        )}
                      </div>

                      <div className="change-impact">
                        {meta.impact && <span className={`impact-badge ${meta.badgeClass}`}>{meta.impact}</span>}
                      </div>

                      <div className="change-why">
                        <span className="why-label">Why is this meaningful?</span>
                        <span className="why-reasons">{data.reasons?.join(" · ") || "—"}</span>
                      </div>

                      <button className="change-remove" onClick={() => handleRemove(symbol)} title="Remove from watchlist">×</button>
                      <button className="change-chevron" onClick={() => handleMarkSeen(symbol)} title="Mark as seen">✓</button>
                    </div>
                  );
                })
              )}

              {filtered.length > 0 && <button className="view-all-btn">View all changes →</button>}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
