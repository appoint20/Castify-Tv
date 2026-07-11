"""
Castify – Netflix-style IPTV backend.

Responsibilities:
  1. Fetch M3U playlists (movies, sport, music, hindi, german).
  2. Parse channel metadata.
  3. Probe each stream URL asynchronously to detect geo-blocked / broken streams.
  4. Persist working channels in MongoDB with last-probed timestamp.
  5. Expose REST endpoints for the React frontend:
        GET  /api/channels        -> grouped channels (optionally with German)
        GET  /api/status          -> probing progress
        POST /api/refresh         -> kick off a fresh probe cycle
        GET  /api/health          -> liveness check
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import re
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

# ─── Configuration ────────────────────────────────────────────────────────
load_dotenv()

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("castify")

PLAYLIST_SOURCES = [
    {"category": "Hindi",  "language": "hin", "url": "https://iptv-org.github.io/iptv/languages/hin.m3u"},
    {"category": "Movies", "language": "any", "url": "https://iptv-org.github.io/iptv/categories/movies.m3u"},
    {"category": "Music",  "language": "any", "url": "https://iptv-org.github.io/iptv/categories/music.m3u"},
    {"category": "Sports", "language": "any", "url": "https://iptv-org.github.io/iptv/categories/sports.m3u"},
    {"category": "German", "language": "deu", "url": "https://iptv-org.github.io/iptv/languages/deu.m3u"},
]

PROBE_CONCURRENCY = 80
PROBE_TIMEOUT = 4.0
FETCH_TIMEOUT = 30.0

# ─── Mongo client ─────────────────────────────────────────────────────────
mongo_client: Optional[AsyncIOMotorClient] = None
db = None

probe_status: Dict[str, Any] = {
    "state": "idle",
    "started_at": None,
    "finished_at": None,
    "total": 0,
    "checked": 0,
    "working": 0,
    "message": "",
}


class Channel(BaseModel):
    id: str
    name: str
    url: str
    logo: str = ""
    group: str = ""
    category: str
    language: str = ""
    country: str = ""
    working: bool = True
    last_probed: Optional[str] = None


_ATTR_RE = re.compile(r'([a-zA-Z-]+)="([^"]*)"')


def parse_m3u(text: str, category: str) -> List[Dict[str, Any]]:
    channels: List[Dict[str, Any]] = []
    meta: Optional[Dict[str, Any]] = None
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("#EXTINF"):
            display_name = line.rsplit(",", 1)[-1].strip() if "," in line else "Unknown"
            attrs = dict(_ATTR_RE.findall(line))
            meta = {
                "name": display_name,
                "logo": attrs.get("tvg-logo", ""),
                "group": attrs.get("group-title", ""),
                "language": attrs.get("tvg-language", ""),
                "country": attrs.get("tvg-country", ""),
                "tvg_id": attrs.get("tvg-id", ""),
                "category": category,
            }
        elif not line.startswith("#") and meta:
            meta["url"] = line
            # Stable ID: md5 of (category + url) — survives process restarts, so favorites persist.
            meta["id"] = f"{category.lower()}_{hashlib.md5(f'{category}|{line}'.encode()).hexdigest()[:16]}"
            channels.append(meta)
            meta = None
    return channels


async def probe_stream(client: httpx.AsyncClient, url: str) -> bool:
    try:
        # Use streaming GET so an unresponsive body never blocks us past the timeout.
        async with client.stream(
            "GET",
            url,
            headers={"Range": "bytes=0-2047", "User-Agent": "VLC/3.0"},
            timeout=PROBE_TIMEOUT,
            follow_redirects=True,
        ) as resp:
            if resp.status_code >= 400:
                return False
        return True
    except Exception:
        return False


async def refresh_channels() -> None:
    global probe_status
    probe_status.update(
        state="fetching",
        started_at=datetime.now(timezone.utc).isoformat(),
        finished_at=None,
        total=0,
        checked=0,
        working=0,
        message="Downloading playlists…",
    )

    # STEP 1: Download every playlist and remember its raw parsed channels
    raw_by_cat: Dict[str, List[Dict[str, Any]]] = {}
    async with httpx.AsyncClient(timeout=FETCH_TIMEOUT) as client:
        for src in PLAYLIST_SOURCES:
            try:
                log.info("Fetching %s from %s", src["category"], src["url"])
                r = await client.get(src["url"])
                r.raise_for_status()
                raw_by_cat[src["category"]] = parse_m3u(r.text, src["category"])
                log.info("→ %s parsed: %d", src["category"], len(raw_by_cat[src["category"]]))
            except Exception as exc:
                log.warning("Failed to fetch %s: %s", src["category"], exc)
                raw_by_cat[src["category"]] = []

    # STEP 2: Build the Indian URL set from the Hindi playlist — used to gate
    # Movies / Music / Sports so only Indian channels get through.
    indian_urls: set[str] = {c["url"] for c in raw_by_cat.get("Hindi", [])}
    log.info("Indian channel set size: %d", len(indian_urls))

    # STEP 3: Merge into one master list while applying the "Indian only" filter
    # to Movies / Music / Sports categories. Also drop channels flagged geo-blocked.
    all_channels: List[Dict[str, Any]] = []
    seen_urls: set[str] = set()

    def include(channel: Dict[str, Any]) -> bool:
        lname = channel["name"].lower()
        if "geo-blocked" in lname or "geo blocked" in lname:
            return False
        # Restrict global category playlists to only channels that appear in the Hindi list.
        if channel["category"] in {"Movies", "Music", "Sports"}:
            return channel["url"] in indian_urls
        # Hindi & German kept as-is
        return True

    # Order matters: process Movies/Music/Sports first so their category label wins
    # over the Hindi "General" fallback for the same URL.
    for cat_name in ("Movies", "Music", "Sports", "Hindi", "German"):
        for c in raw_by_cat.get(cat_name, []):
            if c["url"] in seen_urls:
                continue
            if not include(c):
                continue
            seen_urls.add(c["url"])
            all_channels.append(c)

    log.info("After Indian-filter merge: %d channels to probe", len(all_channels))

    probe_status.update(
        state="probing",
        total=len(all_channels),
        message=f"Probing {len(all_channels)} streams…",
    )

    working: List[Dict[str, Any]] = []
    sem = asyncio.Semaphore(PROBE_CONCURRENCY)
    lock = asyncio.Lock()

    async with httpx.AsyncClient(http2=False) as client:
        async def worker(chan: Dict[str, Any]) -> None:
            async with sem:
                ok = await probe_stream(client, chan["url"])
            async with lock:
                probe_status["checked"] += 1
                if ok:
                    probe_status["working"] += 1
                    chan["working"] = True
                    chan["last_probed"] = datetime.now(timezone.utc).isoformat()
                    working.append(chan)

        await asyncio.gather(*(worker(c) for c in all_channels))

    log.info("Probe finished: %d/%d working", len(working), len(all_channels))

    # Atomic DB swap: write into a temp collection, then rename it over `channels`.
    # This guarantees readers never see an empty collection mid-refresh.
    if db is not None and working:
        temp_name = "channels_new"
        temp_coll = db[temp_name]
        await temp_coll.drop()  # start clean
        for i in range(0, len(working), 500):
            await temp_coll.insert_many(working[i:i + 500])
        # MongoDB's renameCollection with dropTarget is atomic within a single DB.
        await temp_coll.rename("channels", dropTarget=True)
        log.info("Swapped %d channels into DB atomically.", len(working))

    probe_status.update(
        state="done",
        finished_at=datetime.now(timezone.utc).isoformat(),
        message=f"Ready: {len(working)} working channels",
    )


# ─── Scheduled refresh (every 6 hours) ────────────────────────────────────
REFRESH_INTERVAL_SECONDS = 6 * 60 * 60  # 6 h

_scheduler_task: Optional[asyncio.Task] = None


async def scheduled_refresh_loop() -> None:
    """Background loop that re-probes every REFRESH_INTERVAL_SECONDS."""
    while True:
        try:
            await asyncio.sleep(REFRESH_INTERVAL_SECONDS)
            log.info("[scheduler] 6-hour tick — triggering refresh.")
            if probe_status["state"] in ("fetching", "probing"):
                log.info("[scheduler] Refresh already running, skipping this tick.")
                continue
            await refresh_channels()
        except asyncio.CancelledError:
            log.info("[scheduler] Cancelled, exiting loop.")
            raise
        except Exception as exc:  # never let the loop die
            log.exception("[scheduler] Unexpected error: %s", exc)


async def ensure_initial_data() -> None:
    if db is None:
        return
    count = await db.channels.count_documents({})
    if count == 0:
        log.info("Channels collection empty — kicking off first probe.")
        asyncio.create_task(refresh_channels())
    else:
        probe_status.update(state="done", total=count, working=count, message=f"Cached {count} channels")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global mongo_client, db, _scheduler_task
    mongo_client = AsyncIOMotorClient(MONGO_URL)
    db = mongo_client[DB_NAME]
    await ensure_initial_data()
    # Start the 6-hour re-probe scheduler
    _scheduler_task = asyncio.create_task(scheduled_refresh_loop())
    log.info("Scheduler started — refreshing every %d s.", REFRESH_INTERVAL_SECONDS)
    yield
    if _scheduler_task:
        _scheduler_task.cancel()
        try:
            await _scheduler_task
        except (asyncio.CancelledError, Exception):
            pass
    if mongo_client:
        mongo_client.close()


app = FastAPI(title="Castify API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> Dict[str, Any]:
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}


@app.get("/api/status")
async def status() -> Dict[str, Any]:
    return {**probe_status, "refresh_interval_seconds": REFRESH_INTERVAL_SECONDS}


@app.post("/api/refresh")
async def refresh(background: BackgroundTasks) -> Dict[str, Any]:
    if probe_status["state"] in ("fetching", "probing"):
        return {"ok": True, "message": "Refresh already in progress", "status": probe_status}
    background.add_task(refresh_channels)
    return {"ok": True, "message": "Refresh started", "status": probe_status}


@app.get("/api/channels")
async def get_channels(
    include_german: bool = Query(True, description="Whether to include German channels"),
    limit_per_category: int = Query(60, ge=1, le=500),
) -> Dict[str, Any]:
    if db is None:
        raise HTTPException(status_code=503, detail="Database not ready")

    query: Dict[str, Any] = {"working": True}
    if not include_german:
        query["category"] = {"$ne": "German"}

    cursor = db.channels.find(query, {"_id": 0})
    channels: List[Dict[str, Any]] = await cursor.to_list(length=None)

    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for c in channels:
        grouped.setdefault(c["category"], []).append(c)

    for cat, items in grouped.items():
        items.sort(key=lambda x: (not bool(x.get("logo")), x["name"].lower()))
        grouped[cat] = items[:limit_per_category]

    order = ["Movies", "Sports", "Hindi", "Music"] + (["German"] if include_german else [])
    result = [{"category": cat, "channels": grouped.get(cat, [])} for cat in order if grouped.get(cat)]

    return {
        "total_channels": sum(len(g["channels"]) for g in result),
        "categories": result,
        "probe_status": probe_status,
    }


@app.get("/api/hero")
async def get_hero() -> Dict[str, Any]:
    if db is None:
        raise HTTPException(status_code=503, detail="Database not ready")
    for cat in ("Movies", "Hindi", "Sports", "Music"):
        doc = await db.channels.find_one(
            {"working": True, "category": cat, "logo": {"$ne": ""}},
            {"_id": 0},
        )
        if doc:
            return {"channel": doc}
    return {"channel": None}
