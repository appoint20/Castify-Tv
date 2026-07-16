# CastifyTV Smart-Routing Proxy

This folder contains the high-performance, stateless reverse-proxy designed for Smart TV platforms (Android TV, LG webOS) to bypass geo-blocked streams.

## How it Works

Because TV operating systems do not support OS-level VPN toggles natively inside web apps:
1. **Direct Routing:** Standard global channels (German, Movies, Sports) are routed directly from the client TV to the IPTV origin server to preserve server bandwidth.
2. **Proxy Routing (India):** Indian channels (detected by country tag `"IN"`, language `"Hindi"`, or category `"Hindi"`) have their stream URLs rewritten on-the-fly to pass through this proxy server.

```
+------------+      Direct URL      +-----------------------+
|  Smart TV  | -------------------> | Global IPTV Source    |
| (webOS/ATV)|                      +-----------------------+
+------------+
      |
      | Proxied URL (Indian Channels)
      v
+-----------------------------+     Fetch & Rewrite     +-----------------------+
| Indian Proxy Server (Mumbai)| ----------------------> | Indian IPTV Source    |
+-----------------------------+                         +-----------------------+
```

---

## M3U Playlist Tagging Structure

The parser looks for the following metadata tags inside the M3U playlist file to identify Indian channels:

1. **Category Mapping:** If the channel is grouped under the Category `Hindi`.
2. **Country Tag:** `tvg-country="IN"` inside the `#EXTINF` metadata line.
3. **Group Title Tag:** `group-title="India"` or any title containing the word `india`.
4. **Language Tag:** `tvg-language="Hindi"` or language attribute containing `hin`.

### Example Tagged Channel:
```m3u
#EXTINF:-1 tvg-id="9XM" tvg-name="9XM Bollywood" tvg-logo="https://logo.png" tvg-country="IN" tvg-language="Hindi" group-title="India News",9XM Bollywood Music
https://rts-live.yacast.net/rts_fm_300.m3u8
```

---

## Server Deployment Guide

### Prerequisites
* A Cloud VPS located in India (Mumbai, Bangalore, etc.) on AWS, DigitalOcean, or Linode.
* Docker & Docker Compose installed.

### Steps to Deploy

1. **Copy backend files to VPS:**
   Copy `proxy.js`, `Dockerfile`, and `docker-compose.yml` to your VPS server directory (e.g., `/opt/castify-proxy/`).

2. **Deploy via Docker Compose:**
   ```bash
   docker compose up -d --build
   ```

3. **Verify Liveness:**
   Access `http://<your-vps-ip>:8081/health` in your browser. It should return:
   ```json
   {"status":"ok","service":"Castify Proxy"}
   ```

---

## Security Configuration

The proxy is protected by a secret security token (`SECURE_TOKEN`).
* Default Token: `CASTIFY_SECURE_TOKEN_2026`
* To customize, update the environment variable in `docker-compose.yml` before deploying:
  ```yaml
  environment:
    - SECURE_TOKEN=your_custom_secret_key
  ```
* Remember to update the matching token in your app code (`app.js` and `App.tsx`).
