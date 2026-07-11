# Castify — Netflix-Style IPTV App

## Original Problem Statement
> "i want to build netflix clone for my iptv which should only contain Indian channels which work — not the geo-blocked ones. Use these URLs for movies, sport and music, hindi, german. Build a toggle for showing German channels or not."
> App name: **Castify**.
> Follow-ups: (1) Indian filter for Movies/Music, (2) Favorites, (3) Remote next/prev channel while playing.

## Architecture
- **Backend** — FastAPI (`/app/backend/server.py`) on port 8001.
  - Fetches 5 iptv-org playlists: `hin.m3u`, `movies.m3u`, `music.m3u`, `sports.m3u`, `deu.m3u`.
  - **Indian-only filter**: Movies/Music/Sports channels are kept only if their URL also appears in `hin.m3u`; Hindi & German pass through as-is.
  - Streams probed asynchronously (concurrency 80, 4s timeout, streaming GET). Only working URLs persist to MongoDB (`castify.channels`).
  - Stable channel IDs (`md5(category|url)[:16]`) so favorites survive restarts.
  - Endpoints: `/api/health`, `/api/status`, `/api/channels?include_german=...`, `/api/hero`, `/api/refresh`.
- **Frontend** — React + Tailwind (`/app/frontend`), Netflix-style dark theme (#141414, #E50914).
  - Header (fixed): CASTIFY logo, category nav, search, German toggle (default ON).
  - Hero, category rails, ChannelCard with ★ favorite button, VideoPlayerModal (HLS.js).
  - `useFavorites` hook persisted in `localStorage` (`castify_favorites_v1`).
  - Player modal supports: side prev/next buttons (`player-prev-btn`, `player-next-btn`), keyboard ← / → / F / M / Esc, Web Media Session next/prev-track for physical remotes, and hint strip.

## User Personas
- **Casual Indian household viewer** — wants Hindi + Indian movies/sports/music on any browser.
- **NRI in Germany** — wants both Indian channels and German; toggles German OFF when abroad.

## Core Requirements (static)
- Only Indian channels for Movies/Music/Sports (geo-blocked filtered).
- German toggle in header, default ON.
- Netflix-style dark cinematic UI with red accents.
- HLS.js live player with graceful error state.
- Favorites persisted client-side.
- Remote-friendly channel switching (arrow keys + media keys).

## Implemented (Jan 2026)
- ✅ Backend probing pipeline (~655 candidate → ~407 working streams).
- ✅ Indian-only filter on Movies/Music/Sports (Movies 16, Sports 3, Music 7, Hindi 130, German 251).
- ✅ Stable md5-based channel IDs.
- ✅ German toggle default ON.
- ✅ HLS.js player + graceful "Stream unavailable" error UI.
- ✅ Favorites (★ toggle, "★ My Favorites" rail at top, localStorage persistence, works from card + inside player).
- ✅ Remote next/prev channel (side buttons, ←/→, MediaTrackNext/Previous, Media Session API).
- ✅ Search + category jump-nav + hero Watch Now.
- ✅ Tested end-to-end: backend 11/11, frontend 100% — zero bugs.

## Prioritized Backlog
- **P2** — Rewrite `refresh_channels` to insert into a temp collection then rename atomically (avoid empty DB window if insert fails mid-flight).
- **P2** — 6-hour scheduled re-probe (APScheduler).
- **P2** — Hero rotator (cycle 5 hero channels every 8 s).
- **P3** — EPG (xmltv) integration if playlist provides `tvg-url`.
- **P3** — Emergent Google Auth so favorites sync across devices.
- **P3** — Share button that copies a deep-link (`?play=<channel-id>`).

## Next Tasks
- 6-hour scheduled re-probe.
- Deep-link share URL.
