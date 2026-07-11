# Castify — Netflix-Style IPTV App

## Original Problem Statement
> "i want to build netflix clone for my iptv which should only contain Indian channels which work — not the geo-blocked ones. Use these URLs for movies, sport and music, hindi, german. Build a toggle for showing German channels or not: if true show German, if false hide them."
> App name: **Castify**.

## Architecture
- **Backend** — FastAPI on port 8001 (`/app/backend/server.py`)
  - Fetches 5 M3U playlists: Hindi, Movies, Music, Sports, German (iptv-org).
  - Parses M3U → deduplicates → filters name-based "geo-blocked" tags.
  - Probes every stream URL (async httpx, concurrency 80, 4s timeout, streaming GET).
  - Persists working channels in MongoDB (`castify.channels`) with `working=true` and `last_probed`.
  - Endpoints:
    - `GET /api/health`
    - `GET /api/status` — live probing progress
    - `GET /api/channels?include_german=true|false`
    - `GET /api/hero` — a channel for the hero banner
    - `POST /api/refresh` — kick off async re-probe
- **Frontend** — React + Tailwind (`/app/frontend`), Netflix-style dark theme (#141414, #E50914 red)
  - Header (fixed): CASTIFY logo, category nav, search, German toggle (default ON).
  - Hero: full-bleed backdrop, category badge, big title, Watch Now / More Info.
  - Category rails: horizontally scrollable ChannelCards with hover-scale.
  - VideoPlayerModal: HLS.js live player, mute/close controls, loading/error overlays, ESC to close.

## User Personas
- **Casual Indian household viewer** — wants Hindi channels, movies, cricket, music on any browser.
- **NRI in Germany** — needs both Indian channels AND German channels; toggles German OFF when abroad on a slow line.

## Core Requirements (static)
- Filter geo-blocked / broken streams via backend probing.
- Cover the 5 requested M3U playlists (Movies, Sports, Music, Hindi, German).
- German channels toggle (default ON) in the header, filters the Backend query.
- Netflix-style dark cinematic UI with red accents.
- HLS.js live player for `.m3u8` streams.

## Implemented (Jan 2026)
- ✅ Backend probing pipeline: 2400 → ~1529 working channels in ~40s.
- ✅ 5 category rails render live with real channel logos.
- ✅ German toggle default ON; flipping reflows the rails via re-fetch.
- ✅ HLS.js modal player with graceful "stream unavailable" state.
- ✅ Search filter, category jump-nav, hero "Watch Now" flow.
- ✅ Skeleton loaders + progress banner while probing.
- ✅ Backend + Frontend tested by testing agent — 100% pass rate, no critical bugs.

## Prioritized Backlog
- **P1** — Stable channel IDs: replace `hash(url)` with `hashlib.md5(url).hexdigest()[:16]` so IDs survive backend restarts (needed for future favorites feature).
- **P1** — Favorites / Watchlist persisted in localStorage or MongoDB.
- **P2** — Scheduled background re-probe (cron every 6 h) instead of only on first boot.
- **P2** — Multi-source hero (rotate 5 hero channels every 8 s).
- **P2** — EPG (Electronic Program Guide) integration if the M3U provides `tvg-url` xmltv.
- **P3** — User accounts (Emergent Google Auth) so favorites sync across devices.
- **P3** — Share button on the player modal that copies a deep-link (`?play=<channel-id>`).

## Next Tasks
- Stable channel IDs (P1) — small, low-risk refactor.
- Favorites row in the UI once IDs are stable.
