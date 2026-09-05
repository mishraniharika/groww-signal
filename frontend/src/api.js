const BASE_URL = "https://groww-signal.onrender.com";
// ---------------------------------------------------------
// WATCHLISTS
// ---------------------------------------------------------
export async function getWatchlists(userId) {
  const res = await fetch(`${BASE_URL}/watchlist/user/${userId}`);
  if (!res.ok) {
    throw new Error("Failed to fetch watchlists");
  }
  return res.json();
}

export async function createWatchlist(userId, name = "My Watchlist") {
  const res = await fetch(`${BASE_URL}/watchlist/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, name }),
  });
  if (!res.ok) {
    throw new Error("Failed to create watchlist");
  }
  return res.json();
}

export async function addSymbol(watchlistId, symbol) {
  const res = await fetch(`${BASE_URL}/watchlist/${watchlistId}/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol }),
  });
  if (!res.ok) {
    throw new Error("Failed to add symbol");
  }
  return res.json();
}

export async function removeSymbol(watchlistId, symbol) {
  const res = await fetch(
    `${BASE_URL}/watchlist/${watchlistId}/remove/${symbol}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    throw new Error("Failed to remove symbol");
  }
  return res.json();
}

// ---------------------------------------------------------
// MARKET / ATTENTION
// ---------------------------------------------------------
export async function getAttention(userId, symbol) {
  const res = await fetch(`${BASE_URL}/market/attention/${userId}/${symbol}`);
  if (!res.ok) {
    throw new Error("Failed to fetch attention data");
  }
  return res.json();
}

export async function markSeen(userId, symbol) {
  const res = await fetch(`${BASE_URL}/market/snapshot/${userId}/${symbol}`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error("Failed to mark stock as seen");
  }
  return res.json();
}

// ---------------------------------------------------------
// ASSET DETAIL
// ---------------------------------------------------------
export async function getAssetDetail(symbol) {
  const res = await fetch(
    `${BASE_URL}/market/asset-detail/${encodeURIComponent(symbol)}`
  );
  if (!res.ok) {
    throw new Error("Failed to fetch asset detail");
  }
  return res.json();
}

// ---------------------------------------------------------
// RESILIENCE / OUTAGE SIMULATION
// ---------------------------------------------------------
export async function setSimulateFailure(enabled) {
  const res = await fetch(`${BASE_URL}/market/debug/simulate-failure`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) {
    throw new Error("Failed to toggle simulate failure");
  }
  return res.json();
}

export async function getSimulateFailure() {
  const res = await fetch(`${BASE_URL}/market/debug/simulate-failure`);
  if (!res.ok) {
    throw new Error("Failed to get simulate failure state");
  }
  return res.json();
}