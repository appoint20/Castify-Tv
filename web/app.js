/* ═══════════════════════════════════════════════════════════════════
   CastifyTV — Application Logic (LG webOS)
   Layout & behaviour aligned 1:1 with the React Native (Sony/Xiaomi) app:
     • CastifyTV branding
     • Split-screen: metadata banner (left) + inline live video (right)
     • Netflix portrait poster cards, 1.12 focus scale, 3px white border
     • Favorites (★) rails on top, category rails below
     • Autoplay 9XM ▸ Zee Music ▸ B4U Music ▸ first channel
     • Fullscreen mode via floating button / BACK / ESC
     • D-pad navigation for LG webOS remotes
   ─────────────────────────────────────────────────────────────────── */

const PLAYLISTS = [
  { category: 'Movies', url: 'https://iptv-org.github.io/iptv/categories/movies.m3u' },
  { category: 'Sports', url: 'https://iptv-org.github.io/iptv/categories/sport.m3u' },
  { category: 'Music',  url: 'https://iptv-org.github.io/iptv/categories/music.m3u' },
  { category: 'Hindi',  url: 'https://iptv-org.github.io/iptv/languages/hin.m3u' },
  { category: 'German', url: 'https://iptv-org.github.io/iptv/languages/deu.m3u' }
];

const CATEGORY_ORDER = ['Movies', 'Sports', 'Music', 'Hindi', 'German'];

// Guaranteed working seed channels injected on top (mirrors App.tsx injectedChannels)
const INJECTED_CHANNELS = [
  {
    id: 'injected_9xm',
    name: '9XM Music',
    url: 'https://epiconvh.akamaized.net/live/9XM/master.m3u8',
    group: 'Music',
    category: 'Music',
    logo: 'https://static.wikia.nocookie.net/logopedia/images/4/4c/9XM_logo.png'
  },
  {
    id: 'injected_zeemusic',
    name: 'Zee Music',
    url: 'https://f8e7y4c6.ssl.hwcdn.net/magic/playlist.m3u8',
    group: 'Music',
    category: 'Music',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Zee_Music_Company_logo.png/320px-Zee_Music_Company_logo.png'
  },
  {
    id: 'injected_b4umusic',
    name: 'B4U Music',
    url: 'https://cdnb4u.wiseplayout.com/B4U_Music/master.m3u8',
    group: 'Music',
    category: 'Music',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a2/B4U_Music_logo.png'
  }
];

const LS_FAVORITES = 'castifytv.favorites';
const LS_HIDDEN    = 'castifytv.hidden';
const LS_DEFAULTS_INIT = 'castifytv.defaults_initialized';

// Backend URL detection (browser preview only)
const BACKEND_URL = (typeof window !== 'undefined' && window.__BACKEND_URL__)
  || (typeof process !== 'undefined' && process.env && process.env.REACT_APP_BACKEND_URL)
  || detectBackendFromLocation();

function detectBackendFromLocation() {
  try {
    const { origin } = window.location;
    if (origin.includes('emergentagent.com') || origin.includes('localhost')) return origin;
  } catch (e) {}
  return '';
}

// ═══ Global state ═══
const state = {
  allChannels: [],
  workingUrls: new Set(),
  probedUrls: new Set(),
  favorites: new Set(loadLS(LS_FAVORITES)),
  hidden:    new Set(loadLS(LS_HIDDEN)),
  activeFilter: 'all',
  isBackendAvailable: false,
  hlsInstance: null,
  activeChannel: null,   // channel currently playing in right panel
  focusedChannel: null,  // channel highlighted (updates banner)
  isFullscreen: false
};

function loadLS(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) { return []; }
}
function saveLS(key, setObj) {
  try { localStorage.setItem(key, JSON.stringify([...setObj])); } catch(e) {}
}

// ═══ DOM refs ═══
const $ = (id) => document.getElementById(id);
const els = {
  splash: $('splash'),
  splashStatus: $('splash-status'),
  splashSubstatus: $('splash-substatus'),
  app: $('app'),
  navbar: $('topbar'),
  nav: $('category-nav'),
  // banner
  bannerMeta: $('banner-meta'),
  bannerName: $('banner-name'),
  bannerCategory: $('banner-category'),
  bannerDesc: $('banner-desc'),
  favBtn: $('fav-btn'),
  favBtnText: $('fav-btn-text'),
  hideBtn: $('hide-btn'),
  // player
  playerWrapper: $('player-wrapper'),
  player: $('player'),
  playerOverlay: $('player-overlay'),
  playerStatus: $('player-status'),
  fullscreenBtn: $('fullscreen-btn'),
  noActiveStream: $('no-active-stream'),
  // rails
  rails: $('rails'),
  emptyState: $('empty-state'),
  // fullscreen
  fsOverlay: $('fullscreen-overlay'),
  // hint bar
  hintBar: $('hint-bar'),
  hintBackDesc: $('hint-back-desc')
};

// ═══ Bootstrap ═══
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  init();
});

async function init() {
  updateSplash('Contacting server…', '');
  await detectBackend();

  updateSplash('Downloading playlists…', '');
  const channels = await loadAllPlaylists();

  // Inject guaranteed seed channels (Music). Dedupe by URL/name.
  INJECTED_CHANNELS.forEach(inj => {
    const exists = channels.some(c => c.url === inj.url || (c.name && c.name.toLowerCase() === inj.name.toLowerCase()));
    if (!exists) channels.push(inj);
  });

  state.allChannels = channels;

  // Seed default favorites on first launch (mirrors App.tsx defaultKeywords)
  if (!localStorage.getItem(LS_DEFAULTS_INIT)) {
    const defaultKeywords = ['9xm', 'zee music', 'b4u music'];
    channels.forEach(c => {
      if (!c.name || !c.url) return;
      const lname = c.name.toLowerCase();
      if (defaultKeywords.some(k => lname.includes(k))) {
        state.favorites.add(c.url);
      }
    });
    saveLS(LS_FAVORITES, state.favorites);
    localStorage.setItem(LS_DEFAULTS_INIT, '1');
  }

  updateSplash('Testing stream availability…', `Found ${channels.length} channels`);
  await probeAllStreams(channels);

  updateSplash('Almost ready…', '');
  await sleep(200);

  showApp();
  render();
  autoplayStartupChannel();
}

// ═══ Splash helpers ═══
function updateSplash(status, sub = '') {
  if (els.splashStatus) els.splashStatus.textContent = status;
  if (els.splashSubstatus) els.splashSubstatus.textContent = sub;
}
function showApp() {
  els.splash.classList.add('hidden');
  els.app.classList.remove('hidden');
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══ Backend detection ═══
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
  console.log('[CastifyTV] Backend available:', state.isBackendAvailable);
}

// ═══ Playlist fetch + parse ═══
async function loadAllPlaylists() {
  const allChannels = [];
  const seenUrls = new Set();
  let totalDone = 0;

  for (const src of PLAYLISTS) {
    updateSplash(`Downloading ${src.category} channels…`, `${totalDone}/${PLAYLISTS.length} playlists loaded`);
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
      console.log(`[CastifyTV] ${src.category}: parsed ${parsed.length} channels`);
    } catch (err) {
      console.warn(`[CastifyTV] Failed to fetch ${src.category}:`, err);
    }
    totalDone++;
  }

  updateSplash('Playlists loaded', `${allChannels.length} unique channels`);
  return allChannels;
}

async function fetchPlaylistText(url) {
  if (state.isBackendAvailable && BACKEND_URL) {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/playlist?url=${encodeURIComponent(url)}`);
      if (resp.ok) return await resp.text();
    } catch (e) { /* fall through */ }
  }
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
        group: attrs['group-title'] || category,
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

// ═══ Stream probing (geo-blocked filter) ═══
async function probeAllStreams(channels) {
  const urls = channels.map(c => c.url);
  if (urls.length === 0) return;

  if (state.isBackendAvailable && BACKEND_URL) {
    try { await probeViaBackend(urls); return; }
    catch (e) { console.warn('[CastifyTV] Backend probe failed, falling back:', e); }
  }
  await probeClientSide(urls);
}

async function probeViaBackend(urls) {
  const BATCH = 400;
  const total = urls.length;
  let done = 0;
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    updateSplash('Filtering geo-blocked streams…', `${done}/${total} checked`);
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
      console.warn('[CastifyTV] Probe batch failed, assuming all working:', e);
      batch.forEach(u => { state.probedUrls.add(u); state.workingUrls.add(u); });
    }
    done += batch.length;
  }
  updateSplash('Filtering complete', `${state.workingUrls.size}/${total} streams live`);
}

async function probeClientSide(urls) {
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
        updateSplash('Filtering geo-blocked streams…', `${done}/${total} checked`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  updateSplash('Filtering complete', `${state.workingUrls.size}/${total} streams live`);
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

// ═══════════════════════════════════════════════════════════════
//  Rendering (grouped categories with Favorites on top)
// ═══════════════════════════════════════════════════════════════
function computeGrouped() {
  // Filter out hidden + geo-blocked
  const visible = state.allChannels.filter(c => {
    if (state.hidden.has(c.url)) return false;
    if (state.probedUrls.has(c.url) && !state.workingUrls.has(c.url)) return false;
    return true;
  });

  // ── "Channels" view: single alphabetical A-Z grid of ALL channels ──
  if (state.activeFilter === 'channels') {
    const sorted = [...visible].sort((a, b) =>
      (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase())
    );
    // Bucket by first letter (0-9 → "#")
    const buckets = {};
    sorted.forEach(c => {
      const first = (c.name || '?')[0].toUpperCase();
      const key = /[A-Z]/.test(first) ? first : '#';
      (buckets[key] = buckets[key] || []).push(c);
    });
    const letters = Object.keys(buckets).sort((a, b) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    });
    return letters.map(letter => ({
      title: letter,
      channels: buckets[letter],
      layout: 'grid'
    }));
  }

  // Apply top-nav filter (Home / Favorites / Category)
  let filtered = visible;
  if (state.activeFilter === 'favorites') {
    filtered = visible.filter(c => state.favorites.has(c.url));
  } else if (state.activeFilter !== 'all') {
    filtered = visible.filter(c => c.category === state.activeFilter);
  }

  // Favorites first (grouped by subcategory), then standard categories
  const favChannels = filtered.filter(c => state.favorites.has(c.url));
  const favMap = {};
  favChannels.forEach(c => {
    const key = `★ Favorites - ${c.category || 'General'}`;
    (favMap[key] = favMap[key] || []).push(c);
  });
  const favGroups = Object.keys(favMap).sort().map(title => ({ title, channels: favMap[title] }));

  // Standard groups by category
  const stdMap = {};
  filtered.forEach(c => {
    const key = c.category || 'General';
    (stdMap[key] = stdMap[key] || []).push(c);
  });
  const stdGroups = CATEGORY_ORDER
    .filter(cat => stdMap[cat])
    .map(cat => ({ title: cat, channels: stdMap[cat] }));

  return [...favGroups, ...stdGroups];
}

function render() {
  const groups = computeGrouped();
  els.rails.innerHTML = '';

  if (groups.length === 0 || groups.every(g => g.channels.length === 0)) {
    els.emptyState.classList.remove('hidden');
    return;
  }
  els.emptyState.classList.add('hidden');

  groups.forEach(g => {
    if (g.channels.length === 0) return;
    els.rails.appendChild(renderRail(g.title, g.channels, g.layout));
  });
}

function renderRail(title, channels, layout) {
  const isGrid = layout === 'grid';
  // Grid view (Channels A-Z) shows all channels; carousel view limits to 40
  const displayItems = isGrid ? channels : channels.slice(0, 40);

  const rail = document.createElement('section');
  rail.className = 'rail' + (isGrid ? ' rail-grid-section' : '');
  rail.dataset.testid = `rail-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  const header = document.createElement('div');
  header.className = 'rail-header' + (isGrid ? ' rail-header-letter' : '');
  const titleEl = document.createElement('h2');
  titleEl.className = 'rail-title';
  titleEl.textContent = title;
  const count = document.createElement('span');
  count.className = 'rail-count';
  count.textContent = `${channels.length} channels`;
  header.appendChild(titleEl);
  header.appendChild(count);
  rail.appendChild(header);

  const track = document.createElement('div');
  track.className = isGrid ? 'rail-grid' : 'rail-track';
  displayItems.forEach(ch => track.appendChild(renderCard(ch)));
  rail.appendChild(track);

  return rail;
}

// ═══ Card (portrait poster) ═══
const GRADIENTS = [
  ['#1e3a8a', '#312e81'], // Indigo
  ['#831843', '#4c1d95'], // Magenta-Violet
  ['#065f46', '#064e3b'], // Emerald
  ['#7c2d12', '#451a03'], // Orange-Brown
  ['#155e75', '#083344'], // Cyan
  ['#581c87', '#3b0764'], // Purple
  ['#b91c1c', '#450a0a'], // Red
  ['#1e293b', '#0f172a']  // Slate
];
function gradientFor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(h) % GRADIENTS.length];
}
function getInitials(name) {
  if (!name) return 'TV';
  const clean = name.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return (parts[0][0] + (parts[1][0] || '') + (parts[2]?.[0] || '')).toUpperCase();
}

function renderCard(channel) {
  const card = document.createElement('div');
  card.className = 'card';
  card.tabIndex = 0;
  card.dataset.testid = `channel-card-${channel.id}`;
  card.dataset.channelUrl = channel.url;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Play ${channel.name}`);

  const [gTop, gBot] = gradientFor(channel.name);

  // Gradient bg
  const gradient = document.createElement('div');
  gradient.className = 'card-gradient';
  gradient.style.setProperty('--g-top', gTop);
  gradient.style.setProperty('--g-bot', gBot);
  card.appendChild(gradient);

  // Logo / Initials
  const logoWrap = document.createElement('div');
  logoWrap.className = 'card-logo';
  if (channel.logo) {
    const img = document.createElement('img');
    img.src = channel.logo;
    img.alt = channel.name;
    img.loading = 'lazy';
    img.onerror = () => {
      logoWrap.innerHTML = '';
      const div = document.createElement('div');
      div.className = 'card-initials';
      div.textContent = getInitials(channel.name);
      logoWrap.appendChild(div);
    };
    logoWrap.appendChild(img);
  } else {
    const div = document.createElement('div');
    div.className = 'card-initials';
    div.textContent = getInitials(channel.name);
    logoWrap.appendChild(div);
  }
  card.appendChild(logoWrap);

  // Now-playing badge (red)
  if (state.activeChannel && state.activeChannel.url === channel.url) {
    const badge = document.createElement('div');
    badge.className = 'card-playing-badge';
    badge.innerHTML = '<span class="card-playing-dot"></span><span class="card-playing-text">PLAYING</span>';
    card.appendChild(badge);
  }

  // Favorite indicator (gold star)
  if (state.favorites.has(channel.url)) {
    const fav = document.createElement('div');
    fav.className = 'card-favorite-badge';
    fav.textContent = '★';
    card.appendChild(fav);
  }

  // Bottom label
  const label = document.createElement('div');
  label.className = 'card-label';
  const name = document.createElement('div');
  name.className = 'card-name';
  name.textContent = channel.name;
  label.appendChild(name);
  card.appendChild(label);

  card.addEventListener('mouseenter', () => setFocusedChannel(channel));
  card.addEventListener('focus', () => setFocusedChannel(channel));
  card.addEventListener('click', () => playChannel(channel));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.keyCode === 13) {
      e.preventDefault();
      playChannel(channel);
    }
  });

  return card;
}

// ═══════════════════════════════════════════════════════════════
//  Banner (metadata + action buttons)
// ═══════════════════════════════════════════════════════════════
function setFocusedChannel(ch) {
  state.focusedChannel = ch;
  updateBanner();
}

function updateBanner() {
  const ch = state.focusedChannel || state.activeChannel;
  if (!ch) {
    els.bannerName.textContent = 'CastifyTV';
    els.bannerCategory.textContent = 'Load a playlist to start watching';
    els.bannerDesc.textContent = '';
    els.favBtnText.textContent = '+ My Favorites';
    els.favBtn.classList.remove('is-favorite');
    return;
  }
  els.bannerName.textContent = ch.name;
  els.bannerCategory.textContent = ch.group || ch.category || '';
  els.bannerDesc.textContent = 'Now playing live broadcast. Use the D-Pad to browse channels below and press OK to watch.';
  const isFav = state.favorites.has(ch.url);
  els.favBtnText.textContent = isFav ? '✓ My Favorites' : '+ My Favorites';
  els.favBtn.classList.toggle('is-favorite', isFav);
}

function toggleFavoriteActive() {
  const ch = state.focusedChannel || state.activeChannel;
  if (!ch) return;
  if (state.favorites.has(ch.url)) {
    state.favorites.delete(ch.url);
  } else {
    state.favorites.add(ch.url);
  }
  saveLS(LS_FAVORITES, state.favorites);
  updateBanner();
  render();
}

function hideActiveChannel() {
  const ch = state.focusedChannel || state.activeChannel;
  if (!ch) return;

  state.hidden.add(ch.url);
  saveLS(LS_HIDDEN, state.hidden);

  // Find next channel in same group and move active/focused
  const groups = computeGrouped();
  let nextChannel = null;
  for (const g of groups) {
    if (g.channels.length > 0) { nextChannel = g.channels[0]; break; }
  }

  if (state.activeChannel && state.activeChannel.url === ch.url) {
    if (nextChannel) {
      playChannel(nextChannel);
    } else {
      stopPlayback();
    }
  }
  if (nextChannel) setFocusedChannel(nextChannel);
  render();
}

// ═══════════════════════════════════════════════════════════════
//  Autoplay startup channel (mirrors MainLayout.tsx useEffect)
//  9XM ▸ Zee Music ▸ B4U Music ▸ first available
// ═══════════════════════════════════════════════════════════════
function autoplayStartupChannel() {
  const preferences = ['9xm', 'zee music', 'b4u music'];
  let target = null;

  for (const pref of preferences) {
    target = state.allChannels.find(c =>
      c.name && c.name.toLowerCase().includes(pref) &&
      !state.hidden.has(c.url) &&
      (!state.probedUrls.has(c.url) || state.workingUrls.has(c.url))
    );
    if (target) break;
  }
  if (!target) {
    target = state.allChannels.find(c =>
      c.name && !state.hidden.has(c.url) &&
      (!state.probedUrls.has(c.url) || state.workingUrls.has(c.url))
    );
  }
  if (target) {
    setFocusedChannel(target);
    playChannel(target);
  }
}

// ═══════════════════════════════════════════════════════════════
//  HLS Player (inline right panel)
// ═══════════════════════════════════════════════════════════════
function playChannel(channel) {
  if (!channel) return;
  state.activeChannel = channel;
  state.focusedChannel = channel;

  els.noActiveStream.classList.add('hidden');
  els.playerOverlay.classList.remove('hidden');
  els.playerStatus.textContent = `Connecting to ${channel.name}…`;

  updateBanner();
  updateHintBar();
  // Re-render rails so PLAYING badge moves to correct card
  render();

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
    video.src = channel.url;
    video.play().catch(() => { els.playerStatus.textContent = 'Native playback failed.'; });
  } else {
    els.playerStatus.textContent = 'HLS not supported on this device.';
  }
}

function stopPlayback() {
  state.activeChannel = null;
  if (state.hlsInstance) { state.hlsInstance.destroy(); state.hlsInstance = null; }
  try { els.player.pause(); els.player.removeAttribute('src'); els.player.load(); } catch (e) {}
  els.noActiveStream.classList.remove('hidden');
  els.playerOverlay.classList.add('hidden');
  updateBanner();
  updateHintBar();
  render();
}

// ═══════════════════════════════════════════════════════════════
//  Fullscreen mode
// ═══════════════════════════════════════════════════════════════
function toggleFullscreen() {
  state.isFullscreen = !state.isFullscreen;
  els.app.classList.toggle('is-fullscreen', state.isFullscreen);
  els.fsOverlay.classList.toggle('hidden', !state.isFullscreen);
  updateHintBar();
  // hint auto-hide after 3s
  if (state.isFullscreen) {
    setTimeout(() => els.fsOverlay.classList.add('hidden'), 3000);
  }
}

// ═══════════════════════════════════════════════════════════════
//  Event listeners + D-pad navigation
// ═══════════════════════════════════════════════════════════════
function setupEventListeners() {
  // Category nav
  els.nav.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-item');
    if (!btn) return;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.activeFilter = btn.dataset.filter;
    render();
    els.rails.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Banner action buttons
  els.favBtn.addEventListener('click', toggleFavoriteActive);
  els.hideBtn.addEventListener('click', hideActiveChannel);

  // Fullscreen
  els.fullscreenBtn.addEventListener('click', toggleFullscreen);

  // Player events
  els.player.addEventListener('playing', () => {
    els.playerOverlay.classList.add('hidden');
    // once playing, unmute (autoplay policy requires mute-then-unmute)
    els.player.muted = false;
  });
  els.player.addEventListener('waiting', () => {
    els.playerStatus.textContent = 'Buffering…';
    els.playerOverlay.classList.remove('hidden');
  });

  // D-pad focus tracking for nav items + action buttons
  const focusableSelectors = '.nav-item, .action-btn, .control-button, .card';
  document.addEventListener('focusin', (e) => {
    document.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));
    if (e.target.matches(focusableSelectors)) {
      e.target.classList.add('focused');
      // Ensure focused card is scrolled into view within its rail
      if (e.target.classList.contains('card')) {
        e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  });

  // Keyboard / remote handling
  document.addEventListener('keydown', handleKeyDown);
}

function handleKeyDown(e) {
  const key = e.key;
  const code = e.keyCode;

  // ── BACK (webOS 461, Samsung 10009, ESC) — contextual ──
  if (key === 'Escape' || code === 461 || code === 10009) {
    if (state.isFullscreen) {
      e.preventDefault();
      toggleFullscreen();
      return;
    }
    if (state.activeChannel) {
      e.preventDefault();
      stopPlayback();
      return;
    }
  }

  // ── LG Magic Remote color buttons ──
  // RED (403) → toggle favorite on focused/active channel
  if (code === 403) {
    e.preventDefault();
    toggleFavoriteActive();
    flashHint('❤ Favorite toggled');
    return;
  }
  // GREEN (404) → toggle fullscreen
  if (code === 404) {
    e.preventDefault();
    if (state.activeChannel) toggleFullscreen();
    return;
  }

  // D-pad arrow keys — 2D navigation
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key)) {
    handleDpad(key, e);
  }
}

// Briefly flash a hint message on top of the hint bar
let _hintTimer = null;
function flashHint(msg) {
  if (!els.hintBar) return;
  els.hintBar.dataset.flash = msg;
  els.hintBar.classList.add('flash');
  clearTimeout(_hintTimer);
  _hintTimer = setTimeout(() => els.hintBar.classList.remove('flash'), 1400);
}

function updateHintBar() {
  if (!els.hintBackDesc) return;
  if (state.isFullscreen) {
    els.hintBackDesc.textContent = 'Exit Fullscreen';
  } else if (state.activeChannel) {
    els.hintBackDesc.textContent = 'Stop stream';
  } else {
    els.hintBackDesc.textContent = 'Home';
  }
}

function handleDpad(dir, event) {
  const active = document.activeElement;
  const isCard = active && active.classList.contains('card');
  const isNav  = active && active.classList.contains('nav-item');
  const isAction = active && (active.classList.contains('action-btn') || active.classList.contains('control-button'));

  // Nav: Left/Right cycles nav items; Down goes to first action btn (banner) or first card
  if (isNav) {
    const navs = [...document.querySelectorAll('.nav-item')];
    const idx = navs.indexOf(active);
    if (dir === 'ArrowRight' && idx < navs.length - 1) { event.preventDefault(); navs[idx+1].focus(); }
    else if (dir === 'ArrowLeft' && idx > 0)          { event.preventDefault(); navs[idx-1].focus(); }
    else if (dir === 'ArrowDown') {
      event.preventDefault();
      const firstAction = document.querySelector('.action-btn');
      if (firstAction) firstAction.focus();
      else focusFirstCard();
    }
    return;
  }

  // Action buttons (banner): Left/Right between the two, Up back to nav, Down to first card, Right last -> fullscreen btn
  if (isAction && (active.classList.contains('action-btn'))) {
    if (dir === 'ArrowUp') { event.preventDefault(); document.querySelector('.nav-item.active')?.focus() || document.querySelector('.nav-item').focus(); return; }
    if (dir === 'ArrowDown') { event.preventDefault(); focusFirstCard(); return; }
    if (dir === 'ArrowLeft' && active.id === 'hide-btn') { event.preventDefault(); els.favBtn.focus(); return; }
    if (dir === 'ArrowRight' && active.id === 'fav-btn') { event.preventDefault(); els.hideBtn.focus(); return; }
    if (dir === 'ArrowRight' && active.id === 'hide-btn') { event.preventDefault(); els.fullscreenBtn.focus(); return; }
    return;
  }

  // Fullscreen button
  if (active === els.fullscreenBtn) {
    if (dir === 'ArrowLeft') { event.preventDefault(); els.hideBtn.focus(); return; }
    if (dir === 'ArrowUp')   { event.preventDefault(); document.querySelector('.nav-item.active')?.focus(); return; }
    if (dir === 'ArrowDown') { event.preventDefault(); focusFirstCard(); return; }
    return;
  }

  // Card: navigate between cards; grid vs. rail-track behaves differently
  if (isCard) {
    const trackEl = active.parentElement; // either .rail-track or .rail-grid
    if (!trackEl) return;
    const isGrid = trackEl.classList.contains('rail-grid');
    const cards = [...trackEl.querySelectorAll('.card')];
    const idx = cards.indexOf(active);

    // ── GRID layout (Channels A-Z) — 2D wrap navigation by geometry ──
    if (isGrid) {
      if (dir === 'ArrowLeft' && idx > 0) { event.preventDefault(); cards[idx-1].focus(); return; }
      if (dir === 'ArrowRight' && idx < cards.length - 1) { event.preventDefault(); cards[idx+1].focus(); return; }

      const currentRect = active.getBoundingClientRect();
      const currentTop = currentRect.top;
      const currentCenterX = currentRect.left + currentRect.width / 2;

      // Collect all cards across all grids/tracks visible on the page
      const allCards = [...document.querySelectorAll('.card')];

      if (dir === 'ArrowDown') {
        event.preventDefault();
        // Find cards strictly below the current row, then closest by X
        const below = allCards
          .map(c => ({ c, r: c.getBoundingClientRect() }))
          .filter(x => x.r.top > currentTop + 5);
        if (below.length === 0) return;
        // Next row = smallest top among "below"
        const nextRowTop = Math.min(...below.map(x => x.r.top));
        const rowCards = below.filter(x => Math.abs(x.r.top - nextRowTop) < 10);
        const best = rowCards.reduce((best, x) => {
          const dx = Math.abs(x.r.left + x.r.width/2 - currentCenterX);
          return (!best || dx < best.dx) ? { c: x.c, dx } : best;
        }, null);
        if (best) best.c.focus();
        return;
      }
      if (dir === 'ArrowUp') {
        event.preventDefault();
        const above = allCards
          .map(c => ({ c, r: c.getBoundingClientRect() }))
          .filter(x => x.r.top < currentTop - 5);
        if (above.length === 0) {
          // At top row → jump up to letter's rail header? or to banner buttons
          els.favBtn.focus();
          return;
        }
        const prevRowTop = Math.max(...above.map(x => x.r.top));
        const rowCards = above.filter(x => Math.abs(x.r.top - prevRowTop) < 10);
        const best = rowCards.reduce((best, x) => {
          const dx = Math.abs(x.r.left + x.r.width/2 - currentCenterX);
          return (!best || dx < best.dx) ? { c: x.c, dx } : best;
        }, null);
        if (best) best.c.focus();
        return;
      }
    }

    // ── RAIL-TRACK (carousel) — original behavior ──
    if (dir === 'ArrowLeft' && idx > 0) { event.preventDefault(); cards[idx-1].focus(); return; }
    if (dir === 'ArrowRight' && idx < cards.length - 1) { event.preventDefault(); cards[idx+1].focus(); return; }

    if (dir === 'ArrowDown') {
      event.preventDefault();
      const currentRail = active.closest('.rail');
      const nextRail = currentRail.nextElementSibling;
      if (nextRail) {
        const firstCard = nextRail.querySelector('.card');
        if (firstCard) firstCard.focus();
      }
      return;
    }
    if (dir === 'ArrowUp') {
      event.preventDefault();
      const currentRail = active.closest('.rail');
      const prevRail = currentRail.previousElementSibling;
      if (prevRail && prevRail.classList.contains('rail')) {
        const firstCard = prevRail.querySelector('.card');
        if (firstCard) firstCard.focus();
      } else {
        // Top of first rail — jump up to banner action button
        els.favBtn.focus();
      }
      return;
    }
    return;
  }

  // Nothing focused → focus first card on any arrow
  focusFirstCard();
}

function focusFirstCard() {
  const first = document.querySelector('.card');
  if (first) first.focus();
}
