/* ═══════════════════════════════════════════════════════════════════
   IPTVFlix — Application Logic
   ═══════════════════════════════════════════════════════════════════
   Runtime targets:
     • LG webOS TV      → packaged as IPK, direct network access
     • Sony Bravia /    → Android TV / Google TV via WebView layer
       Xiaomi Android TV
     • Desktop browser  → preview mode (needs backend to bypass CORS)
   ─────────────────────────────────────────────────────────────────── */

const PLAYLISTS = [
  { category: 'Movies', url: 'https://iptv-org.github.io/iptv/categories/movies.m3u' },
  { category: 'Sports', url: 'https://iptv-org.github.io/iptv/categories/sport.m3u' },
  { category: 'Music',  url: 'https://iptv-org.github.io/iptv/categories/music.m3u' },
  { category: 'Hindi',  url: 'https://iptv-org.github.io/iptv/languages/hin.m3u' },
  { category: 'German', url: 'https://iptv-org.github.io/iptv/languages/deu.m3u' }
];

const CATEGORY_ORDER = ['Movies', 'Sports', 'Music', 'Hindi', 'German'];

// Backend URL is injected by the browser preview. On real TVs the fetch will
// silently fail and we fall through to direct network access.
const BACKEND_URL = (typeof window !== 'undefined' && window.__BACKEND_URL__)
  || (typeof process !== 'undefined' && process.env && process.env.REACT_APP_BACKEND_URL)
  || detectBackendFromLocation();

function detectBackendFromLocation() {
  try {
    const { origin } = window.location;
    // If we're being served from an Emergent preview URL, backend is on same origin.
    if (origin.includes('emergentagent.com') || origin.includes('localhost')) return origin;
  } catch (e) {}
  return '';
}

// ─── Global State ─────────────────────────────────────────────────
const state = {
  allChannels: [],
  visibleChannels: [],
  workingUrls: new Set(),      // stream URLs confirmed live
  probedUrls: new Set(),       // URLs whose probe result is known
  includeGerman: true,          // default ON (per user requirement)
  activeFilter: 'all',
  searchQuery: '',
  isBackendAvailable: false,
  hlsInstance: null,
  currentChannel: null
};

// ─── DOM refs ─────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const els = {
  splash: $('splash'),
  splashStatus: $('splash-status'),
  splashSubstatus: $('splash-substatus'),
  splashFill: $('splash-progress-fill'),
  app: $('app'),
  topbar: $('topbar'),
  nav: $('category-nav'),
  searchInput: $('search-input'),
  germanToggle: $('german-toggle'),
  hero: $('hero'),
  heroImage: $('hero-image'),
  heroTitle: $('hero-title'),
  heroDesc: $('hero-desc'),
  heroEyebrow: $('hero-eyebrow'),
  heroPlay: $('hero-play'),
  heroInfo: $('hero-info'),
  rails: $('rails'),
  emptyState: $('empty-state'),
  playerModal: $('player-modal'),
  playerClose: $('player-close'),
  player: $('player'),
  playerOverlay: $('player-overlay'),
  playerStatus: $('player-status'),
  playerLogo: $('player-logo'),
  playerTitle: $('player-title'),
  playerCategory: $('player-category')
};

// ─── Bootstrap ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  init();
});

async function init() {
  updateSplash('Contacting server…', '');
  await detectBackend();
  updateSplash('Downloading playlists…', '');
  const channels = await loadAllPlaylists();
  state.allChannels = channels;

  updateSplash('Testing stream availability…', `Found ${channels.length} channels`);
  await probeAllStreams(channels);

  updateSplash('Almost ready…', '');
  await sleep(300);

  showApp();
  renderHero();
  render();
}

// ─── Splash helpers ──────────────────────────────────────────────
function updateSplash(status, sub = '', progress = null) {
  if (els.splashStatus) els.splashStatus.textContent = status;
  if (els.splashSubstatus) els.splashSubstatus.textContent = sub;
  if (progress !== null && els.splashFill) {
    els.splashFill.style.width = Math.min(100, Math.max(0, progress)) + '%';
  }
}

function showApp() {
  els.splash.classList.add('hidden');
  els.app.classList.remove('hidden');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Backend detection ───────────────────────────────────────────
async function detectBackend() {
  if (!BACKEND_URL) { state.isBackendAvailable = false; return; }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(`${BACKEND_URL}/api/health`, { signal: controller.signal });
    clearTimeout(timer);
    state.isBackendAvailable = resp.ok;
  } catch (e) {
    state.isBackendAvailable = false;
  }
  console.log('[IPTVFlix] Backend available:', state.isBackendAvailable);
}

// ─── Playlist fetch + parse ──────────────────────────────────────
async function loadAllPlaylists() {
  const allChannels = [];
  const seenUrls = new Set();
  let totalDone = 0;

  for (const src of PLAYLISTS) {
    updateSplash(`Downloading ${src.category} channels…`, `${totalDone}/${PLAYLISTS.length} playlists loaded`, (totalDone / PLAYLISTS.length) * 40);
    try {
      const text = await fetchPlaylistText(src.url);
      const parsed = parseM3U(text, src.category);
      for (const ch of parsed) {
        if (seenUrls.has(ch.url)) continue;
        const lname = (ch.name || '').toLowerCase();
        if (lname.includes('geo-blocked') || lname.includes('geo blocked')) continue;
        seenUrls.add(ch.url);
        allChannels.push(ch);
      }
      console.log(`[IPTVFlix] ${src.category}: parsed ${parsed.length} channels`);
    } catch (err) {
      console.warn(`[IPTVFlix] Failed to fetch ${src.category}:`, err);
    }
    totalDone++;
  }

  updateSplash('Playlists loaded', `${allChannels.length} unique channels`, 40);
  return allChannels;
}

async function fetchPlaylistText(url) {
  // 1) Try backend proxy (works for browser preview + also works from TVs if backend URL is reachable)
  if (state.isBackendAvailable && BACKEND_URL) {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/playlist?url=${encodeURIComponent(url)}`);
      if (resp.ok) return await resp.text();
    } catch (e) { /* fall through */ }
  }
  // 2) Direct fetch (works on native TV, blocked in browser by CORS)
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.text();
}

const ATTR_RE = /([a-zA-Z-]+)="([^"]*)"/g;

function parseM3U(text, category) {
  const lines = text.split(/\r?\n/);
  const channels = [];
  let meta = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF')) {
      const displayName = line.includes(',') ? line.slice(line.lastIndexOf(',') + 1).trim() : 'Unknown';
      const attrs = {};
      let m;
      ATTR_RE.lastIndex = 0;
      while ((m = ATTR_RE.exec(line)) !== null) attrs[m[1]] = m[2];
      meta = {
        name: displayName,
        logo: attrs['tvg-logo'] || '',
        group: attrs['group-title'] || '',
        language: attrs['tvg-language'] || '',
        country: attrs['tvg-country'] || '',
        tvgId: attrs['tvg-id'] || '',
        category,
      };
    } else if (!line.startsWith('#') && meta) {
      meta.url = line;
      meta.id = `${category}-${meta.name}-${meta.url}`.replace(/[^a-zA-Z0-9-]/g, '_').slice(0, 100);
      channels.push(meta);
      meta = null;
    }
  }
  return channels;
}

// ─── Stream probing (geo-blocked filter) ─────────────────────────
async function probeAllStreams(channels) {
  const urls = channels.map(c => c.url);
  if (urls.length === 0) return;

  // If backend is available, batch-probe there (much faster + no CORS issues).
  if (state.isBackendAvailable && BACKEND_URL) {
    try {
      await probeViaBackend(urls);
      return;
    } catch (e) {
      console.warn('[IPTVFlix] Backend probe failed, falling back to client-side:', e);
    }
  }
  // Fallback: probe from client in batches (works on TVs; in browser most will fail CORS).
  await probeClientSide(urls);
}

async function probeViaBackend(urls) {
  const BATCH = 400;
  const total = urls.length;
  let done = 0;
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    updateSplash('Filtering geo-blocked streams…', `${done}/${total} checked`, 40 + (done / total) * 55);
    try {
      const resp = await fetch(`${BACKEND_URL}/api/probe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: batch })
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      for (const [u, ok] of Object.entries(data.results || {})) {
        state.probedUrls.add(u);
        if (ok) state.workingUrls.add(u);
      }
    } catch (e) {
      console.warn('[IPTVFlix] Probe batch failed, assuming all working:', e);
      // On failure, don't drop the channels — assume they work.
      batch.forEach(u => { state.probedUrls.add(u); state.workingUrls.add(u); });
    }
    done += batch.length;
  }
  updateSplash('Filtering complete', `${state.workingUrls.size}/${total} streams live`, 100);
}

async function probeClientSide(urls) {
  // Lightweight parallel probing — best-effort. On TVs this actually works
  // because there's no CORS restriction; in browser most will 'error' due to CORS.
  const CONCURRENCY = 40;
  const total = urls.length;
  let done = 0;
  let idx = 0;

  async function worker() {
    while (idx < urls.length) {
      const my = idx++;
      const url = urls[my];
      const ok = await probeOne(url);
      state.probedUrls.add(url);
      if (ok) state.workingUrls.add(url);
      done++;
      if (done % 20 === 0) {
        updateSplash('Filtering geo-blocked streams…', `${done}/${total} checked`, 40 + (done / total) * 55);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  updateSplash('Filtering complete', `${state.workingUrls.size}/${total} streams live`, 100);
}

async function probeOne(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(url, {
      method: 'GET',
      headers: { 'Range': 'bytes=0-1023' },
      signal: controller.signal,
      mode: 'cors'
    });
    clearTimeout(timer);
    if (resp.type === 'opaque') return false;
    return resp.ok || resp.status === 206;
  } catch (e) {
    return false;
  }
}

// ─── Rendering ───────────────────────────────────────────────────
function computeVisible() {
  const q = state.searchQuery.trim().toLowerCase();
  return state.allChannels.filter(c => {
    if (!state.workingUrls.has(c.url) && state.probedUrls.has(c.url)) return false;
    if (!state.includeGerman && c.category === 'German') return false;
    if (state.activeFilter !== 'all' && c.category !== state.activeFilter) return false;
    if (q && !(c.name.toLowerCase().includes(q) || (c.group || '').toLowerCase().includes(q))) return false;
    return true;
  });
}

function render() {
  const visible = computeVisible();
  state.visibleChannels = visible;

  // Group by category
  const grouped = {};
  for (const ch of visible) {
    (grouped[ch.category] = grouped[ch.category] || []).push(ch);
  }

  // Determine display order
  const displayCategories = state.activeFilter === 'all'
    ? CATEGORY_ORDER
    : [state.activeFilter];

  els.rails.innerHTML = '';
  let hasContent = false;

  for (const cat of displayCategories) {
    if (!state.includeGerman && cat === 'German') continue;
    const items = grouped[cat] || [];
    if (items.length === 0) continue;
    hasContent = true;
    els.rails.appendChild(renderRail(cat, items));
  }

  els.emptyState.classList.toggle('hidden', hasContent);
}

function renderRail(category, channels) {
  const MAX = 40;
  const displayItems = channels.slice(0, MAX);

  const rail = document.createElement('section');
  rail.className = 'rail';
  rail.dataset.category = category;
  rail.dataset.testid = `rail-${category.toLowerCase()}`;

  const header = document.createElement('div');
  header.className = 'rail-header';
  const title = document.createElement('h2');
  title.className = 'rail-title';
  title.textContent = category;
  const count = document.createElement('span');
  count.className = 'rail-count';
  count.textContent = channels.length > MAX ? `${MAX}+ of ${channels.length}` : `${channels.length} channels`;
  header.appendChild(title);
  header.appendChild(count);
  rail.appendChild(header);

  const track = document.createElement('div');
  track.className = 'rail-track';
  displayItems.forEach(ch => track.appendChild(renderCard(ch)));
  rail.appendChild(track);

  return rail;
}

function renderCard(channel) {
  const card = document.createElement('div');
  card.className = 'card';
  card.tabIndex = 0;
  card.dataset.testid = `channel-card-${channel.id}`;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Play ${channel.name}`);

  const poster = document.createElement('div');
  poster.className = 'card-poster';

  if (channel.logo) {
    const img = document.createElement('img');
    img.src = channel.logo;
    img.alt = channel.name;
    img.loading = 'lazy';
    img.onerror = () => {
      poster.classList.add('no-logo');
      poster.innerHTML = '';
      const initials = getInitials(channel.name);
      const [ga, gb] = gradientFor(channel.name);
      poster.style.setProperty('--gradient-a', ga);
      poster.style.setProperty('--gradient-b', gb);
      const div = document.createElement('div');
      div.className = 'card-initials';
      div.textContent = initials;
      poster.appendChild(div);
    };
    poster.appendChild(img);
  } else {
    poster.classList.add('no-logo');
    const [ga, gb] = gradientFor(channel.name);
    poster.style.setProperty('--gradient-a', ga);
    poster.style.setProperty('--gradient-b', gb);
    const div = document.createElement('div');
    div.className = 'card-initials';
    div.textContent = getInitials(channel.name);
    poster.appendChild(div);
  }
  card.appendChild(poster);

  const live = document.createElement('span');
  live.className = 'card-badge-live';
  live.textContent = 'LIVE';
  card.appendChild(live);

  const playIcon = document.createElement('div');
  playIcon.className = 'card-play-icon';
  playIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  card.appendChild(playIcon);

  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const name = document.createElement('div');
  name.className = 'card-name';
  name.textContent = channel.name;
  const group = document.createElement('div');
  group.className = 'card-group';
  group.textContent = channel.group || channel.category;
  meta.appendChild(name);
  meta.appendChild(group);
  card.appendChild(meta);

  card.addEventListener('click', () => playChannel(channel));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      playChannel(channel);
    }
  });

  return card;
}

function getInitials(name) {
  if (!name) return 'TV';
  const clean = name.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1][0] || '')).toUpperCase();
}

const GRADIENTS = [
  ['#e11d48', '#7c2d12'], ['#dc2626', '#7f1d1d'], ['#ea580c', '#7c2d12'],
  ['#7c3aed', '#4c1d95'], ['#0ea5e9', '#0c4a6e'], ['#059669', '#064e3b'],
  ['#c026d3', '#701a75'], ['#0891b2', '#164e63'], ['#d97706', '#78350f']
];
function gradientFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(h) % GRADIENTS.length];
}

// ─── Hero ────────────────────────────────────────────────────────
const HERO_IMAGES = {
  Movies: 'https://images.pexels.com/photos/3379932/pexels-photo-3379932.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=1600',
  Sports: 'https://images.pexels.com/photos/35898730/pexels-photo-35898730.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=1600',
  Music:  'https://images.pexels.com/photos/26447525/pexels-photo-26447525.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=1600',
  Hindi:  'https://images.pexels.com/photos/3379932/pexels-photo-3379932.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=1600',
  German: 'https://images.pexels.com/photos/26447525/pexels-photo-26447525.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=1600',
  all:    'https://images.pexels.com/photos/3379932/pexels-photo-3379932.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=1600'
};

function renderHero() {
  const cat = state.activeFilter === 'all' ? 'Movies' : state.activeFilter;
  const workingChannels = state.allChannels.filter(c =>
    (!state.probedUrls.has(c.url) || state.workingUrls.has(c.url)) &&
    c.category === cat &&
    !!c.name
  );
  const featured = workingChannels[Math.floor(Math.random() * Math.min(10, workingChannels.length))] || workingChannels[0];

  els.heroImage.style.backgroundImage = `url(${HERO_IMAGES[cat] || HERO_IMAGES.all})`;

  if (featured) {
    els.heroEyebrow.textContent = `${cat.toUpperCase()} · LIVE NOW`;
    els.heroTitle.textContent = featured.name;
    els.heroDesc.textContent = `${featured.group || cat} — streaming live. Sit back and enjoy a Netflix-style live TV experience across all your favorite categories.`;
    els.heroPlay.onclick = () => playChannel(featured);
  } else {
    els.heroEyebrow.textContent = 'IPTVFLIX · LIVE TV';
    els.heroTitle.textContent = 'Netflix-style Live Television';
    els.heroDesc.textContent = 'Movies, Sport, Music, Hindi and German live channels — geo-blocked streams already removed for you.';
    els.heroPlay.onclick = () => {
      if (state.visibleChannels[0]) playChannel(state.visibleChannels[0]);
    };
  }
}

// ─── HLS Player ──────────────────────────────────────────────────
function playChannel(channel) {
  if (!channel) return;
  state.currentChannel = channel;

  els.playerModal.classList.remove('hidden');
  els.playerOverlay.classList.remove('hidden');
  els.playerStatus.textContent = `Connecting to ${channel.name}…`;
  els.playerTitle.textContent = channel.name;
  els.playerCategory.textContent = `${channel.category}${channel.group ? ' · ' + channel.group : ''}`;
  if (channel.logo) {
    els.playerLogo.src = channel.logo;
    els.playerLogo.style.display = 'block';
    els.playerLogo.onerror = () => { els.playerLogo.style.display = 'none'; };
  } else {
    els.playerLogo.style.display = 'none';
  }

  const video = els.player;
  video.pause();
  try { video.removeAttribute('src'); video.load(); } catch (e) {}

  if (state.hlsInstance) { state.hlsInstance.destroy(); state.hlsInstance = null; }

  if (window.Hls && Hls.isSupported()) {
    let retries = 0;
    state.hlsInstance = new Hls({
      enableWorker: true,
      maxBufferLength: 30,
      lowLatencyMode: false,
      capLevelToPlayerSize: true
    });
    state.hlsInstance.loadSource(channel.url);
    state.hlsInstance.attachMedia(video);
    state.hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(err => console.warn('Autoplay blocked:', err));
    });
    state.hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      if (!data.fatal) return;
      retries++;
      if (retries > 3) {
        els.playerStatus.textContent = `Unable to play — this stream may be offline or region-locked.`;
        els.playerOverlay.classList.remove('hidden');
        return;
      }
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) state.hlsInstance.startLoad();
      else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) state.hlsInstance.recoverMediaError();
      else {
        els.playerStatus.textContent = `Playback error: ${data.details}`;
        els.playerOverlay.classList.remove('hidden');
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Native HLS (Safari, iOS, LG webOS)
    video.src = channel.url;
    video.play().catch(err => {
      els.playerStatus.textContent = 'Native playback failed.';
    });
  } else {
    els.playerStatus.textContent = 'HLS not supported on this device.';
  }
}

function closePlayer() {
  els.playerModal.classList.add('hidden');
  if (state.hlsInstance) { state.hlsInstance.destroy(); state.hlsInstance = null; }
  try { els.player.pause(); els.player.removeAttribute('src'); els.player.load(); } catch (e) {}
}

// ─── Event Listeners ─────────────────────────────────────────────
function setupEventListeners() {
  // Category nav
  els.nav.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-item');
    if (!btn) return;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.activeFilter = btn.dataset.filter;
    renderHero();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Search
  els.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    render();
  });

  // German toggle
  els.germanToggle.addEventListener('change', (e) => {
    state.includeGerman = e.target.checked;
    // If we're currently filtering by German and turn it off, revert to all
    if (!state.includeGerman && state.activeFilter === 'German') {
      state.activeFilter = 'all';
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      const homeBtn = document.querySelector('.nav-item[data-filter="all"]');
      if (homeBtn) homeBtn.classList.add('active');
      renderHero();
    }
    render();
  });

  // Player controls
  els.playerClose.addEventListener('click', closePlayer);
  els.playerModal.addEventListener('click', (e) => {
    // Click on backdrop closes
    if (e.target.classList.contains('player-backdrop')) closePlayer();
  });

  // Keyboard: Escape closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.keyCode === 461 /* webOS Back */) {
      if (!els.playerModal.classList.contains('hidden')) {
        e.preventDefault();
        closePlayer();
      }
    }
  });

  // Video events
  els.player.addEventListener('playing', () => els.playerOverlay.classList.add('hidden'));
  els.player.addEventListener('waiting', () => {
    els.playerStatus.textContent = 'Buffering…';
    els.playerOverlay.classList.remove('hidden');
  });

  // Header scroll effect
  window.addEventListener('scroll', () => {
    els.topbar.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
}
