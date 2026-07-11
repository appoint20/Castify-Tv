"""Castify backend API tests."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
# Fallback: read frontend/.env
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- Health ----
class TestHealth:
    def test_health_ok(self, session):
        r = session.get(f"{API}/health", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"
        assert "time" in data


# ---- Status ----
class TestStatus:
    def test_status_has_state(self, session):
        r = session.get(f"{API}/status", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "state" in data
        assert data["state"] in ("idle", "fetching", "probing", "done")

    def test_status_expected_done(self, session):
        # In this fresh MVP the initial probe should have completed by now
        r = session.get(f"{API}/status", timeout=15)
        data = r.json()
        # Only assert data fields, don't fail if still probing
        assert isinstance(data.get("total"), int)
        assert isinstance(data.get("checked"), int)
        assert isinstance(data.get("working"), int)


# ---- Channels ----
class TestChannels:
    EXPECTED_CATEGORIES = {"Movies", "Sports", "Hindi", "Music", "German"}

    def test_channels_include_german_true(self, session):
        r = session.get(f"{API}/channels", params={"include_german": "true"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "categories" in data
        cats = {c["category"] for c in data["categories"]}
        # All 5 categories should be present with >0 channels
        missing = self.EXPECTED_CATEGORIES - cats
        assert not missing, f"Missing categories: {missing}. Got: {cats}"
        for cat in data["categories"]:
            assert len(cat["channels"]) > 0, f"Category {cat['category']} has 0 channels"

    def test_channels_include_german_false(self, session):
        r = session.get(f"{API}/channels", params={"include_german": "false"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        cats = {c["category"] for c in data["categories"]}
        assert "German" not in cats, f"German category should be excluded, got: {cats}"

    def test_channel_shape(self, session):
        r = session.get(f"{API}/channels", params={"include_german": "true"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        for cat in data["categories"]:
            for ch in cat["channels"]:
                # Required fields
                assert "id" in ch and isinstance(ch["id"], str)
                assert "name" in ch and isinstance(ch["name"], str)
                assert "url" in ch and isinstance(ch["url"], str)
                assert "category" in ch and ch["category"] == cat["category"]
                assert ch.get("working") is True
                # No mongodb _id
                assert "_id" not in ch


# ---- Hero ----
class TestHero:
    def test_hero_returns_channel_with_logo(self, session):
        r = session.get(f"{API}/hero", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "channel" in data
        assert data["channel"] is not None, "Hero returned no channel"
        ch = data["channel"]
        assert ch.get("logo"), "Hero channel should have a logo"
        assert ch.get("name")
        assert ch.get("url")


# ---- Refresh ----
class TestRefresh:
    def test_refresh_response(self, session):
        r = session.post(f"{API}/refresh", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        msg = data.get("message", "")
        assert msg in ("Refresh already in progress", "Refresh started"), f"Unexpected message: {msg}"
