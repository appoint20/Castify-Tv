#!/usr/bin/env python3
"""
Fetch the iptv-org India playlist, filter to Music/Movies/Sports,
and verify each stream URL actually responds. Output verified channels.
"""
import json, re, hashlib, urllib.request, ssl, sys, os
from concurrent.futures import ThreadPoolExecutor, as_completed

INPUT_FILE = sys.argv[1] if len(sys.argv) > 1 else None
OUTPUT_FILE = "src/channels.json"

ATTR_RE = re.compile(r'([a-zA-Z-]+)="([^"]*)"')

# Categories we want
WANTED = {'music', 'movies', 'entertainment', 'sports', 'comedy', 'kids', 'family', 'classic', 'animation'}

def group_ok(group_str):
    parts = [p.strip().lower() for p in group_str.replace(';', ',').split(',')]
    return any(p in WANTED for p in parts)

def parse_m3u(text):
    channels = []
    meta = None
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("#EXTINF"):
            name = line.rsplit(",", 1)[-1].strip() if "," in line else "Unknown"
            attrs = dict(ATTR_RE.findall(line))
            meta = {
                "name": name,
                "group": attrs.get("group-title", "General"),
                "logo": attrs.get("tvg-logo", ""),
            }
        elif not line.startswith("#") and meta:
            meta["url"] = line
            meta["id"] = "in_" + hashlib.md5(line.encode()).hexdigest()[:12]
            channels.append(meta)
            meta = None
    return channels

def check_stream(ch):
    """Test if a stream URL responds with 200 within 3 seconds."""
    url = ch["url"]
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Linux; Android TV) CastifyTV/1.0"
        })
        resp = urllib.request.urlopen(req, timeout=4, context=ctx)
        code = resp.getcode()
        content_type = resp.headers.get("Content-Type", "")
        # Read a tiny bit to confirm it's streaming
        data = resp.read(512)
        resp.close()
        if code == 200 and len(data) > 10:
            return ch
    except Exception:
        pass
    return None

def main():
    # Read input
    if INPUT_FILE and os.path.exists(INPUT_FILE):
        with open(INPUT_FILE, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
        print(f"Read {len(text)} bytes from {INPUT_FILE}")
    else:
        print("Downloading fresh iptv-org India playlist...")
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(
            "https://iptv-org.github.io/iptv/countries/in.m3u",
            headers={"User-Agent": "CastifyTV/1.0"}
        )
        resp = urllib.request.urlopen(req, timeout=15, context=ctx)
        text = resp.read().decode("utf-8", errors="ignore")
        print(f"Downloaded {len(text)} bytes")

    # Parse
    all_ch = parse_m3u(text)
    print(f"Parsed {len(all_ch)} total channels")

    # Filter to wanted categories
    filtered = [c for c in all_ch if group_ok(c["group"])]
    print(f"After category filter: {len(filtered)}")

    # Deduplicate
    seen = set()
    unique = []
    for c in filtered:
        if c["url"] not in seen:
            seen.add(c["url"])
            unique.append(c)
    print(f"After dedup: {len(unique)}")

    # Verify streams concurrently (max 20 threads)
    print(f"\nVerifying {len(unique)} stream URLs (this takes ~30s)...")
    verified = []
    with ThreadPoolExecutor(max_workers=20) as pool:
        futures = {pool.submit(check_stream, c): c for c in unique}
        done_count = 0
        for future in as_completed(futures):
            done_count += 1
            result = future.result()
            if result:
                verified.append(result)
                print(f"  ✓ [{done_count}/{len(unique)}] {result['name']}")
            else:
                ch = futures[future]
                print(f"  ✗ [{done_count}/{len(unique)}] {ch['name']} — DEAD")

    print(f"\n{'='*50}")
    print(f"VERIFIED WORKING: {len(verified)} / {len(unique)}")

    # Group breakdown
    groups = {}
    for c in verified:
        g = c["group"]
        groups[g] = groups.get(g, 0) + 1
    for g in sorted(groups.keys()):
        print(f"  {groups[g]:3d}  {g}")

    # Write
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(verified, f, indent=2)
    print(f"\nWrote {len(verified)} verified Indian channels to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
