const BASE_URL = "http://127.0.0.1:8000";

export async function getWatchlists(userId) {
  const res = await fetch(`${BASE_URL}/watchlist/user/${userId}`);
  return res.json();
}

export async function createWatchlist(userId, name = "My Watchlist") {
  const res = await fetch(`${BASE_URL}/watchlist/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, name }),
  });
  return res.json();
}

export async function addSymbol(watchlistId, symbol) {
  const res = await fetch(`${BASE_URL}/watchlist/${watchlistId}/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol }),
  });
  return res.json();
}

export async function removeSymbol(watchlistId, symbol) {
  const res = await fetch(`${BASE_URL}/watchlist/${watchlistId}/remove/${symbol}`, {
    method: "DELETE",
  });
  return res.json();
}

export async function getAttention(userId, symbol) {
  const res = await fetch(`${BASE_URL}/market/attention/${userId}/${symbol}`);
  return res.json();
}

export async function markSeen(userId, symbol) {
  const res = await fetch(`${BASE_URL}/market/snapshot/${userId}/${symbol}`, {
    method: "POST",
  });
  return res.json();
}