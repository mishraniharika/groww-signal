# Groww Signal

**A watchlist that remembers what you saw.**

Built for Groww's CODE 2026 hackathon — Smart Market Watchlist challenge.

- **Live app:** https://growwsignal.vercel.app/
- **Live API:** https://groww-signal.onrender.com
- **Repo:** https://github.com/mishraniharika/groww-signal

## What this is

Most watchlists show you a price and a percentage change and leave the interpretation to you. Groww Signal instead answers a narrower, harder question: *of everything in your watchlist, what actually changed in a way worth your attention since you last looked — and why?*

It does this with a deterministic, rules-based **Meaningfulness Engine** rather than an opaque ML score, so every flag comes with a plain-language reason. It deliberately does **not** predict prices or recommend trades — see `DECISIONS.md` for why.

## Core features

- **Watchlist CRUD** — create a watchlist, add/remove symbols, persisted in MongoDB
- **Live market data** — price, % change, volume, previous close via `yfinance`
- **Snapshot persistence** — the app remembers the price/volume you last saw for each stock
- **Meaningfulness Engine** — compares current data to your last snapshot and to Nifty, flags `high` / `notable` / `routine`, with explicit `reasons[]`
- **Asset Detail page** — real 1-month price history chart, an "unusualness" stat (today's move vs. the stock's own 30-day average daily move), and a live news timeline
- **Data quality badges** — `fresh` / `stale` / `unavailable` surfaced wherever a quote is shown
- **Outage simulation toggle** — flip a switch to demonstrate the last-known-good cache fallback live, without touching your network
- **Symbol resolution** — common company names and renamed tickers (e.g. `INFOSYS` → `INFY.NS`, `ZOMATO` → `ETERNAL.NS`) resolve automatically
- **Unit tests** for the change-detection and meaningfulness pure functions

## Tech stack

- **Backend:** FastAPI, PyMongo, `yfinance`
- **Frontend:** React (Vite), Recharts, lucide-react
- **Database:** MongoDB Atlas
- **Deployment:** Render (backend), Vercel (frontend)

## Project structure

```
backend/
  app/
    main.py                    # FastAPI app, CORS
    database.py                 # MongoDB connection
    models/watchlist.py
    routers/
      watchlist.py              # CRUD endpoints
      market.py                 # quote, attention, snapshot, asset-detail, debug endpoints
    services/
      market_data.py            # yfinance adapter, symbol resolution, cache fallback, failure toggle
      snapshot.py                # last-seen state per user+symbol
      change_detection.py        # pure function: snapshot vs current quote
      meaningfulness.py          # pure function: signals -> attention level + reasons
  tests/                        # unit tests for change_detection + meaningfulness
frontend/
  src/
    App.jsx                     # all views: Home, Watchlists, Asset Detail
    api.js                      # backend API calls
    index.css
```

## Running locally

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

Create `backend/.env`:
```
MONGO_URI=<your MongoDB Atlas connection string>
```

```bash
uvicorn app.main:app --reload
```
Runs on `http://127.0.0.1:8000`. Interactive API docs at `/docs`.

**Run tests:**
```bash
cd backend
pytest
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```
Runs on `http://localhost:5173`.

> `frontend/src/api.js` points to the deployed backend (`https://groww-signal.onrender.com`) by default. To run fully locally, change `BASE_URL` to `http://127.0.0.1:8000`.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `MONGO_URI` | Render / `backend/.env` | MongoDB Atlas connection string |

## Demoing resilience live

On the Home page, click **"⚡ Simulate Data Outage"**. This flips a server-side flag (`POST /market/debug/simulate-failure`) that forces every quote fetch to serve from the MongoDB cache instead of calling `yfinance`, with a `stale` data-quality badge shown throughout the UI. Click it again to restore live data. This exists specifically to demonstrate the fallback behavior on demand, since real market data rarely fails predictably during a short live demo.

## Further reading

- `ARCHITECTURE.md` — system design, diagram, and how each part maps to the judging criteria
- `DECISIONS.md` — key trade-offs and why they were made
- `PITCH.md` — the 100-word submission pitch
