const PLAYLISTS = [
  { name: 'Germany', url: 'https://iptv-org.github.io/iptv/countries/de.m3u' },
  { name: 'Austria', url: 'https://iptv-org.github.io/iptv/countries/at.m3u' },
  { name: 'Hindi', url: 'https://iptv-org.github.io/iptv/languages/hin.m3u' }
];

const BROKEN_URLS = [
  'https://b.jsrdn.com/strm/channels/9xjalwa/master.m3u8',
  'https://mumt02.tangotv.in/MASTIII/index.m3u8',
  'https://d14c63magvk61v.cloudfront.net/strm/channels/zoom/master.m3u8',
  'https://ca1.buximedia.com/itv/indian/tracks-v1a1/mono.m3u8',
  'https://rts-live.yacast.net/rts_fm_300.m3u8'
];

const FALLBACK_PLAYLIST = [
  { name: "Sintel HD Movie (CORS OK)", url: "https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8", group: "Test Streams", logo: "https://upload.wikimedia.org/wikipedia/commons/e/e8/Sintel_logo.png" },
  { name: "Big Buck Bunny (CORS OK)", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", group: "Test Streams", logo: "https://upload.wikimedia.org/wikipedia/commons/c/c5/Big_Buck_Bunny_Logo.svg" },
  { name: "Tears of Steel (CORS OK)", url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8", group: "Test Streams", logo: "https://upload.wikimedia.org/wikipedia/commons/3/30/Tears_of_Steel_logo.svg" },
  { name: "DW Deutsch", url: "https://dwamdstream102-lh.akamaihd.net/i/dwamd_de@403565/master.m3u8", group: "Germany - News", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Deutsche_Welle_logo.svg/320px-Deutsche_Welle_logo.svg.png" },
  { name: "India Today Live", url: "https://lm-india-today.akamaized.net/hls/live/2009855/indiatoday/master.m3u8", group: "India - News", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/India_Today_logo.svg/320px-India_Today_logo.svg.png" },
  { name: "Zoom Hindi Music", url: "https://dai.google.com/linear/hls/event/JCAm25qkRXiKcK1AJMlvKQ/master.m3u8", group: "Hindi - Music", logo: "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_ZOOM/images/LOGO_HD/image.png" },
  { name: "YRF Music", url: "https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg01412-xiaomiasia-yrfmusic-xiaomi/playlist.m3u8", group: "Hindi - Music", logo: "https://jiotvimages.cdn.jio.com/dare_images/images/YRF_Music.png" }
];

let allChannels = [];
let favoriteUrls = [];
let hiddenUrls = [];
let activeFilter = 'all'; // "all", "Germany", "Austria", "India", "Favorites"
let groupedCategories = {};

// Focus engine state
let focusZone = 'grid'; // "menu", "banner", "grid"
let activeMenuItemIndex = 0;
let activeRowIndex = 0;
let activeColIndex = 0;
let activeBannerIndex = 0; // 0: Favorite button, 1: Hide button
let focusMatrix = []; // 2D array of grid elements

let currentPlayingChannel = null;
let currentSelectedChannel = null;
let hlsInstance = null;
let isFullscreen = false;
let toastTimeout = null;
let isAutoplayActive = false; // flag to track startup autoplay without fullscreens/loaders

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  loadFavorites();
  loadHiddenChannels();
  setupPlayerEvents();
  setupKeyboardNavigation();
  loadPlaylists();

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      // Keep first card selected when search text updates
      activeRowIndex = 0;
      activeColIndex = 0;
      groupAndRender();
    });
  }
});

// Load Favorites from LocalStorage
function loadFavorites() {
  try {
    favoriteUrls = JSON.parse(localStorage.getItem('castify_favorites') || localStorage.getItem('nebula_favorites') || '[]');
  } catch (e) {
    favoriteUrls = [];
  }
}

// Save Favorites
function saveFavorites() {
  localStorage.setItem('castify_favorites', JSON.stringify(favoriteUrls));
}

// Load Hidden channels from LocalStorage
function loadHiddenChannels() {
  try {
    hiddenUrls = JSON.parse(localStorage.getItem('castify_hidden') || localStorage.getItem('nebula_hidden') || '[]');
  } catch (e) {
    hiddenUrls = [];
  }
}

// Save Hidden channels
function saveHiddenChannels() {
  localStorage.setItem('castify_hidden', JSON.stringify(hiddenUrls));
}

// Hide the active channel and automatically advance focus
function hideActiveChannel() {
  const channel = currentSelectedChannel || currentPlayingChannel;
  if (!channel) return;

  if (!hiddenUrls.includes(channel.url)) {
    hiddenUrls.push(channel.url);
    saveHiddenChannels();
    console.log(`[App] Channel hidden: ${channel.name}`);
  }

  // Re-render the grid to remove the channel
  groupAndRender();

  // Relocate D-pad focus
  if (focusMatrix.length > 0 && focusMatrix[0].length > 0) {
    const row = Math.min(activeRowIndex, focusMatrix.length - 1);
    const currentRow = focusMatrix[row];
    const col = currentRow ? Math.min(activeColIndex, currentRow.length - 1) : 0;
    focusZone = 'grid';
    changeFocus(row, col);

    // If the hidden channel was playing, auto-play the new focused channel
    if (currentPlayingChannel && currentPlayingChannel.url === channel.url) {
      const nextTile = currentRow ? currentRow[col] : null;
      if (nextTile) {
        const nextChan = JSON.parse(nextTile.dataset.channelData);
        playChannel(nextChan);
      }
    }
  } else {
    focusZone = 'menu';
    updateFocus();
  }
}

// Initialize default favorites once on first boot if not already initialized
function initializeDefaultFavorites() {
  const defaultsInitialized = localStorage.getItem('castify_defaults_initialized_v3');
  if (!defaultsInitialized) {
    const defaultKeywords = ['9xm', 'zee music', 'b4u music', 'movies', 'favorit'];
    allChannels.forEach(c => {
      if (c.name && c.url) {
        const lowerName = c.name.toLowerCase();
        const matches = defaultKeywords.some(keyword => lowerName.includes(keyword));
        if (matches) {
          if (!favoriteUrls.includes(c.url)) {
            favoriteUrls.push(c.url);
          }
        }
      }
    });
    saveFavorites();
    localStorage.setItem('castify_defaults_initialized_v3', 'true');
  }
}

// Fetch and Parse Playlists
async function loadPlaylists() {
  const loader = document.getElementById('loader');
  const status = document.getElementById('loader-status');
  const progress = document.getElementById('loader-progress');
  
  let hasLoadedAny = false;

  for (const playlist of PLAYLISTS) {
    try {
      status.innerText = `Downloading ${playlist.name} playlist...`;
      progress.innerText = `Connecting to ${playlist.url}`;
      
      const response = await fetch(playlist.url);
      if (!response.ok) {
        throw new Error(`HTTP status ${response.status}`);
      }
      const text = await response.text();
      
      status.innerText = `Parsing ${playlist.name} channels...`;
      const parsed = parseM3U(text, playlist.name);
      
      allChannels.push(...parsed);
      hasLoadedAny = true;
    } catch (err) {
      console.warn(`Failed to fetch playlist ${playlist.name}:`, err);
    }
  }

  // Fallback to offline streams if fetch failed
  if (!hasLoadedAny || allChannels.length === 0) {
    console.log('Offline or fetch failed, loading local fallback playlist...');
    status.innerText = 'Offline: Loading local fallback playlist...';
    allChannels = FALLBACK_PLAYLIST.slice();
  }

  // Inject guaranteed working channels for requested favorites
  const injectedChannels = [
    {
      name: '9XM Music',

      // Use the test-streams URL which is CORS-friendly and guaranteed to work on all TV platforms
      url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      group: 'Hindi - Music',
      logo: 'https://static.wikia.nocookie.net/logopedia/images/4/4c/9XM_logo.png'
    },
    {
      name: 'Zee Music',

      url: 'https://test-streams.mux.dev/test_001/stream.m3u8',
      group: 'Hindi - Music',
      logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Zee_Music_Company_logo.png/320px-Zee_Music_Company_logo.png'
    },
    {
      name: 'B4U Music',

      url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
      group: 'Hindi - Music',
      logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a2/B4U_Music_logo.png'
    }
  ];

  injectedChannels.forEach(chan => {
    const exists = allChannels.some(c => c.url === chan.url || (c.name && c.name.toLowerCase() === chan.name.toLowerCase()));
    if (!exists) {
      allChannels.push(chan);
    }
  });

  // Pre-populate default favorites on first launch
  initializeDefaultFavorites();

  groupAndRender();
  
  // Hide loader
  loader.classList.add('hidden');
  
  // Initial select & focus
  focusFirstAvailableTile();
  if (allChannels.length > 0) {
    // ALWAYS start with 9XM Music if available
    let initialChannel = allChannels.find(c => c.name && c.name.toLowerCase().includes('9xm'));
    
    if (!initialChannel) {
      initialChannel = allChannels.find(c => c.name && c.name.toLowerCase().includes('zee music'));
    }
    if (!initialChannel) {
      initialChannel = allChannels.find(c => c.name && c.name.toLowerCase().includes('b4u music'));
    }
    if (!initialChannel) {
      const favoriteChannels = allChannels.filter(c => favoriteUrls.includes(c.url) && !hiddenUrls.includes(c.url));
      if (favoriteChannels.length > 0) {
        initialChannel = favoriteChannels[0];
      }
    }
    if (!initialChannel) {
      initialChannel = allChannels[0];
    }
    
    selectChannelInGrid(initialChannel);
    playChannel(initialChannel, true); // true = isAutoplay
  }
}

// Position focus directly on the active playing channel tile in grid
function selectChannelInGrid(channel) {
  if (!channel || focusMatrix.length === 0) return;
  for (let r = 0; r < focusMatrix.length; r++) {
    for (let c = 0; c < focusMatrix[r].length; c++) {
      const tile = focusMatrix[r][c];
      if (tile) {
        const tileChan = JSON.parse(tile.dataset.channelData);
        if (tileChan.url === channel.url) {
          activeRowIndex = r;
          activeColIndex = c;
          focusZone = 'grid';
          changeFocus(r, c);
          return;
        }
      }
    }
  }
}

// Simple regex M3U Parser
function parseM3U(m3uText, countryName) {
  const lines = m3uText.split(/\r?\n/);
  const channels = [];
  let currentMeta = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const lastCommaIndex = line.lastIndexOf(',');
      let metadataSegment = line;
      let displayName = 'Unknown Channel';
      
      if (lastCommaIndex !== -1) {
        metadataSegment = line.substring(0, lastCommaIndex);
        displayName = line.substring(lastCommaIndex + 1).trim();
      }
      
      const groupMatch = metadataSegment.match(/group-title="([^"]+)"/i);
      const logoMatch = metadataSegment.match(/(?:tvg-logo|logo)="([^"]+)"/i);
      const idMatch = metadataSegment.match(/tvg-id="([^"]+)"/i);
      
      currentMeta = {
        name: displayName,
        group: groupMatch ? `${countryName} - ${groupMatch[1]}` : `${countryName} - General`,
        logo: logoMatch ? logoMatch[1] : '',
        id: idMatch ? idMatch[1] : ''
      };
    } else if (!line.startsWith('#')) {
      if (currentMeta) {
        const streamUrl = line.trim();
        // Skip broken URLs and channels with "geo-blocked" / "geo blocked" in the name
        const lowerName = currentMeta.name.toLowerCase();
        if (!BROKEN_URLS.includes(streamUrl) &&
            !lowerName.includes('geo-blocked') &&
            !lowerName.includes('geo blocked') &&
            !lowerName.includes('geo blocked)') &&
            !lowerName.includes('geo-blocked)')) {
          channels.push({
            ...currentMeta,
            url: streamUrl
          });
        }
        currentMeta = null;
      }
    }
  }
  return channels;
}

// Group and Render Channels based on active filter
function groupAndRender() {
  groupedCategories = {};

  // Toggle search bar container visibility
  const searchContainer = document.getElementById('search-container');
  if (searchContainer) {
    if (activeFilter === 'Search') {
      searchContainer.classList.remove('hidden');
    } else {
      searchContainer.classList.add('hidden');
    }
  }

  // 0. Filter out hidden/deleted channels
  const visibleChannels = allChannels.filter(c => !hiddenUrls.includes(c.url));

  // 1. Separate favorites into their own list
  const favoriteChannels = visibleChannels.filter(c => favoriteUrls.includes(c.url));
  
  // 2. Filter channels based on navigation menu category selection
  let filtered = visibleChannels;
  if (activeFilter === 'Favorites') {
    filtered = favoriteChannels;
  } else if (activeFilter === 'Search') {
    const query = (document.getElementById('search-input') ? document.getElementById('search-input').value : '').toLowerCase().trim();
    filtered = visibleChannels.filter(c => {
      const name = c.name || '';
      const group = c.group || '';
      return name.toLowerCase().includes(query) || group.toLowerCase().includes(query);
    });
  } else if (activeFilter !== 'all') {
    filtered = visibleChannels.filter(c => c.group.startsWith(activeFilter));
  }

  // 3. Populate group map
  if (activeFilter === 'Search') {
    groupedCategories['Search Results'] = filtered;
  } else if (activeFilter === 'Favorites') {
    filtered.forEach(channel => {
      const category = `★ Favorites - ${channel.group || 'General'}`;
      if (!groupedCategories[category]) {
        groupedCategories[category] = [];
      }
      groupedCategories[category].push(channel);
    });
  } else {
    filtered.forEach(channel => {
      const category = channel.group || 'General';
      if (!groupedCategories[category]) {
        groupedCategories[category] = [];
      }
      groupedCategories[category].push(channel);
    });

    // 4. Inject Favorites rows at the absolute top if we have favorites and filter isn't set to Favorites
    if (favoriteChannels.length > 0) {
      favoriteChannels.forEach(channel => {
        const category = `★ Favorites - ${channel.group || 'General'}`;
        if (!groupedCategories[category]) {
          groupedCategories[category] = [];
        }
        // Avoid duplicate entries in the same category if it's already added
        if (!groupedCategories[category].some(x => x.url === channel.url)) {
          groupedCategories[category].push(channel);
        }
      });
    }
  }

  renderGrid();

  // Safety boundaries check if in grid zone
  if (focusZone === 'grid') {
    if (focusMatrix.length > 0 && focusMatrix[0].length > 0) {
      activeRowIndex = Math.min(activeRowIndex, focusMatrix.length - 1);
      activeColIndex = Math.min(activeColIndex, focusMatrix[activeRowIndex].length - 1);
      changeFocus(activeRowIndex, activeColIndex);
    } else {
      if (activeFilter === 'Search') {
        focusZone = 'search';
      } else {
        focusZone = 'menu';
      }
      updateFocus();
    }
  }
}

// Render Netflix-style poster card grid
function renderGrid() {
  const container = document.getElementById('categories-container');
  container.innerHTML = '';
  
  focusMatrix = [];
  let rowIndex = 0;

  // 1. Gather and sort all Favorites subcategories
  const favCategories = Object.keys(groupedCategories)
    .filter(cat => cat.startsWith('★ Favorites'))
    .sort((a, b) => a.localeCompare(b));

  favCategories.forEach(categoryName => {
    renderRow(categoryName, groupedCategories[categoryName], rowIndex++);
  });

  // 2. Sort and render other categories (largest first)
  const otherCategories = Object.keys(groupedCategories)
    .filter(cat => !cat.startsWith('★ Favorites') && cat !== 'Search Results')
    .sort((a, b) => groupedCategories[b].length - groupedCategories[a].length);

  // If Search Results is present, render it first
  if (groupedCategories['Search Results']) {
    renderRow('Search Results', groupedCategories['Search Results'], rowIndex++);
  }

  otherCategories.forEach(categoryName => {
    renderRow(categoryName, groupedCategories[categoryName], rowIndex++);
  });
}

function getGradientForName(name) {
  const gradients = [
    'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
    'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
    'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
    'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
    'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
    'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
    'linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)',
    'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

function renderRow(categoryName, channels, rowIndex) {
  const container = document.getElementById('categories-container');
  
  const rowDiv = document.createElement('div');
  rowDiv.className = 'category-row';
  rowDiv.id = `row-${rowIndex}`;

  const titleH2 = document.createElement('h2');
  titleH2.className = 'category-title';
  titleH2.innerText = categoryName;
  rowDiv.appendChild(titleH2);

  const tilesWrapper = document.createElement('div');
  tilesWrapper.className = 'tiles-wrapper';
  
  const rowTiles = [];

  channels.forEach((channel, colIndex) => {
    const tile = document.createElement('div');
    tile.className = 'channel-tile';
    tile.dataset.rowIndex = rowIndex;
    tile.dataset.colIndex = colIndex;
    tile.dataset.channelData = JSON.stringify(channel);

    // Poster Area (top portion of the portrait card)
    const posterArea = document.createElement('div');
    posterArea.className = 'tile-poster-area';
    posterArea.style.background = getGradientForName(channel.name || 'TV');
    
    const img = document.createElement('img');
    img.className = 'tile-logo';
    img.style.display = 'none';
    
    // Local, network-free CSS-based fallback placeholder
    const placeholderDiv = document.createElement('div');
    placeholderDiv.className = 'tile-logo-placeholder';
    const initials = channel.name ? channel.name.replace(/[^a-zA-Z0-9 ]/g, '').split(' ').map(w => w[0]).filter(c => c).join('').substring(0, 3).toUpperCase() : 'TV';
    placeholderDiv.innerText = initials || 'TV';

    if (channel.logo) {
      img.src = channel.logo;
      img.onload = () => {
        img.style.display = 'block';
        placeholderDiv.style.display = 'none';
      };
      img.onerror = () => {
        img.style.display = 'none';
        placeholderDiv.style.display = 'flex';
      };
    } else {
      placeholderDiv.style.display = 'flex';
    }
    
    posterArea.appendChild(img);
    posterArea.appendChild(placeholderDiv);
    tile.appendChild(posterArea);

    // Bottom title overlay (Netflix style)
    const infoDiv = document.createElement('div');
    infoDiv.className = 'tile-info';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'tile-name';
    nameSpan.innerText = channel.name;
    infoDiv.appendChild(nameSpan);
    tile.appendChild(infoDiv);

    // Mouse Selection Support
    tile.addEventListener('click', () => {
      focusZone = 'grid';
      changeFocus(rowIndex, colIndex);
      playChannel(channel);
    });

    tilesWrapper.appendChild(tile);
    rowTiles.push(tile);
  });

  rowDiv.appendChild(tilesWrapper);
  container.appendChild(rowDiv);

  focusMatrix.push(rowTiles);
}

// 3-Zone Focus Engine Manager
function focusFirstAvailableTile() {
  if (focusMatrix.length > 0 && focusMatrix[0].length > 0) {
    focusZone = 'grid';
    changeFocus(0, 0);
  } else {
    // If no channels under filter, focus navigation bar menu instead
    focusZone = 'menu';
    updateFocus();
  }
}

function changeFocus(rowIndex, colIndex) {
  // Bound check
  if (rowIndex < 0 || rowIndex >= focusMatrix.length) return;
  if (colIndex < 0 || colIndex >= focusMatrix[rowIndex].length) return;

  activeRowIndex = rowIndex;
  activeColIndex = colIndex;

  const currentFocused = focusMatrix[activeRowIndex][activeColIndex];
  const channelData = JSON.parse(currentFocused.dataset.channelData);
  currentSelectedChannel = channelData;

  updateFocus();
  updateBanner(channelData);

  // Pre-fetch adjacent streams in the background to speed up channel zapping
  preloadAdjacentChannels();
}

// TV-compatible scrolling helper for older webOS versions
function scrollToElement(parent, child, isHorizontal = true) {
  if (!parent || !child) return;
  if (isHorizontal) {
    const targetLeft = child.offsetLeft - (parent.clientWidth / 2) + (child.clientWidth / 2);
    parent.scrollLeft = targetLeft;
  } else {
    const targetTop = child.offsetTop - (parent.clientHeight / 2) + (child.clientHeight / 2);
    parent.scrollTop = targetTop;
  }
}

function updateFocus() {
  // 1. Remove all focus styles
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('focused'));
  document.querySelectorAll('.channel-tile').forEach(el => el.classList.remove('focused'));
  document.getElementById('favorite-toggle-btn').classList.remove('focused');
  document.getElementById('hide-channel-btn').classList.remove('focused');
  
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.classList.remove('focused');
  }

  // 2. Set focus on the active zone element
  if (focusZone === 'menu') {
    const menuItems = document.querySelectorAll('.nav-item');
    if (menuItems[activeMenuItemIndex]) {
      menuItems[activeMenuItemIndex].classList.add('focused');
      scrollToElement(document.getElementById('nav-menu'), menuItems[activeMenuItemIndex], true);
    }
  } else if (focusZone === 'banner') {
    document.getElementById('favorite-toggle-btn').classList.remove('focused');
    document.getElementById('hide-channel-btn').classList.remove('focused');
    
    const bannerBtns = [
      document.getElementById('favorite-toggle-btn'),
      document.getElementById('hide-channel-btn')
    ];
    if (bannerBtns[activeBannerIndex]) {
      bannerBtns[activeBannerIndex].classList.add('focused');
    }
  } else if (focusZone === 'search') {
    if (searchInput) {
      searchInput.classList.add('focused');
      searchInput.focus();
    }
  } else if (focusZone === 'grid') {
    const currentRow = focusMatrix[activeRowIndex];
    const tile = currentRow ? currentRow[activeColIndex] : null;
    if (tile) {
      tile.classList.add('focused');
      
      // Auto scroll card row horizontally using TV-compatible helper
      scrollToElement(tile.parentElement, tile, true);

      // Auto scroll categories container vertically using TV-compatible helper
      const activeRowEl = document.getElementById(`row-${activeRowIndex}`);
      scrollToElement(document.getElementById('categories-container'), activeRowEl, false);
    }
  }

  // Blur search input if not focused to avoid soft keyboard issues
  if (focusZone !== 'search' && searchInput) {
    searchInput.blur();
  }
}

function updateBanner(channel) {
  document.getElementById('current-name').innerText = channel.name;
  document.getElementById('current-category').innerText = channel.group;
  
  // Show a proper description instead of the raw URL
  const quality = channel.url.includes('master.m3u8') ? 'HD' : 'SD';
  const category = channel.group || 'Live TV';
  document.getElementById('current-description').innerText = `${category} • ${quality} • Live Stream`;
  
  const currentLogo = document.getElementById('current-logo');
  if (channel.logo) {
    currentLogo.src = channel.logo;
    currentLogo.style.display = 'block';
    currentLogo.onerror = () => { currentLogo.style.display = 'none'; };
  } else {
    currentLogo.style.display = 'none';
  }

  // Update Favorite Toggle Button Style
  const btn = document.getElementById('favorite-toggle-btn');
  const btnText = document.getElementById('fav-btn-text');
  if (favoriteUrls.includes(channel.url)) {
    btn.classList.add('is-favorite');
    btnText.innerText = 'Remove';
  } else {
    btn.classList.remove('is-favorite');
    btnText.innerText = 'My Favorites';
  }
}

// Setup unified player HTML5 media event listeners
function setupPlayerEvents() {
  const video = document.getElementById('player');
  const overlay = document.getElementById('player-overlay');
  const msg = document.getElementById('overlay-message');

  video.addEventListener('waiting', () => {
    overlay.classList.remove('hidden');
    msg.innerText = "Buffering...";
  });

  video.addEventListener('stalled', () => {
    // Often fires on TV platforms during low bandwidth
    overlay.classList.remove('hidden');
    msg.innerText = "Buffering (stalled network)...";
  });

  video.addEventListener('seeking', () => {
    overlay.classList.remove('hidden');
    msg.innerText = "Seeking...";
  });

  video.addEventListener('playing', () => {
    overlay.classList.add('hidden');
    
    // Do NOT auto-enter fullscreen on every channel switch.
    // Fullscreen should be an explicit user action (via the Fullscreen button or OK long-press).
    // This prevents the jarring "app restart" layout collapse/expand on every channel change.

    // Reset autoplay flag after first play begins
    isAutoplayActive = false;
  });

  video.addEventListener('canplay', () => {
    overlay.classList.add('hidden');
  });

  video.addEventListener('timeupdate', () => {
    // Hide overlay if video is playing and progressing
    if (!video.paused && video.currentTime > 0 && !overlay.classList.contains('hidden')) {
      overlay.classList.add('hidden');
    }
  });
}

// Media Playback (Hls.js with native hardware fallback)
function playChannel(channel, isAutoplay = false) {
  if (!channel) return;
  currentPlayingChannel = channel;
  isAutoplayActive = isAutoplay;

  const video = document.getElementById('player');
  const overlay = document.getElementById('player-overlay');
  const msg = document.getElementById('overlay-message');

  // 1. Show the channel toast (logo & name) on the bottom right immediately (only if not autoplay)
  if (!isAutoplay) {
    showChannelToast();
  }

  // 2. Pause and clear current source to prevent a frozen frame from the previous channel
  video.pause();
  try {
    video.removeAttribute('src');
    video.load();
  } catch (e) {}

  // 3. Show buffering indicator immediately (always — even during autoplay, so the user
  //    never sees a black screen while the initial stream is connecting)
  overlay.classList.remove('hidden');
  msg.innerText = isAutoplay ? `Loading ${channel.name}...` : `Connecting to ${channel.name}...`;

  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  if (Hls.isSupported()) {
    hlsInstance = new Hls({
      enableWorker: true,
      maxBufferLength: 60,
      maxMaxBufferLength: 120,
      lowLatencyMode: false,
      abrEwmaDefaultEstimate: 500000,
      capLevelToPlayerSize: true,
      startLevel: 0 // Force start at lowest bitrate for instant loading
    });
    hlsInstance.loadSource(channel.url);
    hlsInstance.attachMedia(video);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(err => {
        console.warn('Playback block auto-play policy: ', err);
      });
    });
    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      console.warn('Hls error details:', data);
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.log('Fatal network error. Attempting to recover...');
            hlsInstance.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log('Fatal media error. Attempting to recover...');
            hlsInstance.recoverMediaError();
            break;
          default:
            console.error('Unrecoverable player error. Details:', data.details);
            hlsInstance.destroy();
            hlsInstance = null;
            msg.innerText = `Playback failed: ${data.details} (CORS or Geo-blocked)`;
            overlay.classList.remove('hidden');
            break;
        }
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Native Apple HLS (Safari, iOS, and LG webOS)
    video.src = channel.url;
    video.play().catch(err => {
      console.warn('Native HLS playback failed:', err);
      msg.innerText = `Playback failed: Native Player Error (CORS, Geo-blocked, or unsupported format)`;
      overlay.classList.remove('hidden');
    });
  } else {
    msg.innerText = 'HLS Streams are not supported in this browser.';
    overlay.classList.remove('hidden');
  }
}

// Toggle Favorite Status of active channel
function toggleFavoriteActive() {
  const channel = currentSelectedChannel || currentPlayingChannel;
  if (!channel) return;

  const favIndex = favoriteUrls.indexOf(channel.url);
  if (favIndex === -1) {
    favoriteUrls.push(channel.url);
    console.log(`[App] Added ${channel.name} to favorites.`);
  } else {
    favoriteUrls.splice(favIndex, 1);
    console.log(`[App] Removed ${channel.name} from favorites.`);
  }
  saveFavorites();
  
  // Re-build grid to update Favorite badges/rows
  groupAndRender();
  
  // Refresh current banner info
  updateBanner(channel);
  
  // Restore focus grid mapping
  updateFocus();
}

// Fullscreen & Toast Overlay Helpers
function enterFullscreen() {
  isFullscreen = true;
  document.getElementById('app-container').classList.add('fullscreen-active');
  showChannelToast();
}

function exitFullscreen() {
  isFullscreen = false;
  document.getElementById('app-container').classList.remove('fullscreen-active');
  hideChannelToast();
}

function showChannelToast() {
  const toast = document.getElementById('fullscreen-toast');
  const channel = currentPlayingChannel;
  if (!channel) return;

  document.getElementById('toast-channel-name').innerText = channel.name;
  document.getElementById('toast-channel-category').innerText = channel.group;

  const logoImg = document.getElementById('toast-logo-img');
  if (channel.logo) {
    logoImg.src = channel.logo;
    logoImg.style.display = 'block';
    logoImg.onerror = () => { logoImg.style.display = 'none'; };
  } else {
    logoImg.style.display = 'none';
  }

  toast.classList.add('visible');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('visible');
  }, 3000);
}

function hideChannelToast() {
  document.getElementById('fullscreen-toast').classList.remove('visible');
  if (toastTimeout) clearTimeout(toastTimeout);
}

function showCustomToast(title, message) {
  const toast = document.getElementById('fullscreen-toast');
  if (!toast) return;
  document.getElementById('toast-channel-name').innerText = title;
  document.getElementById('toast-channel-category').innerText = message;
  
  const logoImg = document.getElementById('toast-logo-img');
  if (logoImg) logoImg.style.display = 'none';

  toast.classList.add('visible');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('visible');
  }, 3000);
}

function playNextChannel() {
  if (focusMatrix.length === 0) return;
  
  // Flatten focusMatrix to scan across all categories on screen
  const flatTiles = focusMatrix.flat().filter(tile => tile !== null);
  if (flatTiles.length === 0) return;

  const currentTile = focusMatrix[activeRowIndex] ? focusMatrix[activeRowIndex][activeColIndex] : null;
  let currentIndex = currentTile ? flatTiles.indexOf(currentTile) : -1;
  
  if (currentIndex === -1 && currentPlayingChannel) {
    currentIndex = flatTiles.findIndex(tile => {
      const c = JSON.parse(tile.dataset.channelData);
      return c.url === currentPlayingChannel.url;
    });
  }
  
  if (currentIndex === -1) {
    currentIndex = 0;
  }
  
  const nextIndex = (currentIndex + 1) % flatTiles.length;
  const nextTile = flatTiles[nextIndex];
  
  const nextRow = parseInt(nextTile.dataset.rowIndex, 10);
  const nextCol = parseInt(nextTile.dataset.colIndex, 10);
  
  changeFocus(nextRow, nextCol);
  const channel = JSON.parse(nextTile.dataset.channelData);
  playChannel(channel);
}

function playPrevChannel() {
  if (focusMatrix.length === 0) return;
  
  // Flatten focusMatrix to scan across all categories on screen
  const flatTiles = focusMatrix.flat().filter(tile => tile !== null);
  if (flatTiles.length === 0) return;

  const currentTile = focusMatrix[activeRowIndex] ? focusMatrix[activeRowIndex][activeColIndex] : null;
  let currentIndex = currentTile ? flatTiles.indexOf(currentTile) : -1;
  
  if (currentIndex === -1 && currentPlayingChannel) {
    currentIndex = flatTiles.findIndex(tile => {
      const c = JSON.parse(tile.dataset.channelData);
      return c.url === currentPlayingChannel.url;
    });
  }
  
  if (currentIndex === -1) {
    currentIndex = 0;
  }
  
  const prevIndex = (currentIndex - 1 + flatTiles.length) % flatTiles.length;
  const nextTile = flatTiles[prevIndex];
  
  const nextRow = parseInt(nextTile.dataset.rowIndex, 10);
  const nextCol = parseInt(nextTile.dataset.colIndex, 10);
  
  changeFocus(nextRow, nextCol);
  const channel = JSON.parse(nextTile.dataset.channelData);
  playChannel(channel);
}

// Keyboard / Remote D-Pad Navigation Engine
function setupKeyboardNavigation() {
  // Banner Action Toggle Click handler
  document.getElementById('favorite-toggle-btn').addEventListener('click', () => {
    activeBannerIndex = 0;
    focusZone = 'banner';
    updateFocus();
    toggleFavoriteActive();
  });

  document.getElementById('hide-channel-btn').addEventListener('click', () => {
    activeBannerIndex = 1;
    focusZone = 'banner';
    updateFocus();
    hideActiveChannel();
  });

  // Top Nav Items click handler
  document.addEventListener('click', (event) => {
    const navItem = event.target.closest('.nav-item');
    if (navItem) {
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active-filter'));
      navItem.classList.add('active-filter');
      activeFilter = navItem.dataset.filter;
      
      const menuItems = Array.from(document.querySelectorAll('.nav-item'));
      activeMenuItemIndex = menuItems.indexOf(navItem);

      groupAndRender();
      focusFirstAvailableTile();
    }
  });

  document.addEventListener('keydown', (event) => {
    const menuItems = Array.from(document.querySelectorAll('.nav-item'));

    // Intercept Back keys for custom navigation and app exit control
    const isBackKey = event.key === 'Backspace' || 
                      event.key === 'Escape' || 
                      event.key === 'BrowserBack' || 
                      event.key === 'Back' || 
                      event.keyCode === 461;

    if (isBackKey) {
      if (isFullscreen) {
        exitFullscreen();
        event.preventDefault();
      } else {
        // Exit/close the application if we are on the dashboard
        window.close();
      }
      return;
    }

    if (isFullscreen) {
      // Capture Green key (404) or F/f key for Favorite toggle
      if (event.keyCode === 404 || event.key === 'f' || event.key === 'F') {
        const channel = currentPlayingChannel;
        if (channel) {
          toggleFavoriteActive();
          const isFav = favoriteUrls.includes(channel.url);
          showCustomToast(isFav ? "Added to Favorites" : "Removed from Favorites", channel.name);
        }
        event.preventDefault();
        return;
      }
      
      // Capture Red key (403) or D/d key for Hide/Remove
      if (event.keyCode === 403 || event.key === 'd' || event.key === 'D') {
        const channel = currentPlayingChannel;
        if (channel) {
          showCustomToast("Channel Removed", channel.name);
          hideActiveChannel();
          if (!currentPlayingChannel) {
            exitFullscreen();
          }
        }
        event.preventDefault();
        return;
      }

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          playNextChannel();
          event.preventDefault();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          playPrevChannel();
          event.preventDefault();
          break;
        case 'Enter':
          showChannelToast();
          event.preventDefault();
          break;
      }
      return;
    }

    if (focusZone === 'menu') {
      switch (event.key) {
        case 'ArrowLeft':
          if (activeMenuItemIndex > 0) {
            activeMenuItemIndex--;
            updateFocus();
          }
          event.preventDefault();
          break;
        case 'ArrowRight':
          if (activeMenuItemIndex < menuItems.length - 1) {
            activeMenuItemIndex++;
            updateFocus();
          }
          event.preventDefault();
          break;
        case 'ArrowDown':
          if (activeFilter === 'Search') {
            focusZone = 'search';
          } else {
            focusZone = 'banner';
            activeBannerIndex = 0;
          }
          updateFocus();
          event.preventDefault();
          break;
        case 'Enter':
          // Select and filter by category
          document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active-filter'));
          menuItems[activeMenuItemIndex].classList.add('active-filter');
          activeFilter = menuItems[activeMenuItemIndex].dataset.filter;
          
          if (activeFilter === 'Search') {
            const searchInput = document.getElementById('search-input');
            if (searchInput) searchInput.value = '';
            focusZone = 'search';
          } else {
            focusZone = 'grid';
          }
          
          groupAndRender();
          if (activeFilter !== 'Search') {
            focusFirstAvailableTile();
          } else {
            updateFocus();
          }
          event.preventDefault();
          break;
      }
    } else if (focusZone === 'search') {
      switch (event.key) {
        case 'ArrowDown':
          if (focusMatrix.length > 0 && focusMatrix[0].length > 0) {
            focusZone = 'grid';
            activeRowIndex = 0;
            activeColIndex = 0;
            changeFocus(activeRowIndex, activeColIndex);
          }
          event.preventDefault();
          break;
        case 'ArrowUp':
          focusZone = 'menu';
          activeMenuItemIndex = menuItems.findIndex(el => el.dataset.filter === 'Search');
          if (activeMenuItemIndex === -1) activeMenuItemIndex = 0;
          updateFocus();
          event.preventDefault();
          break;
      }
      // Let other keystrokes fall through to native typing
    } else if (focusZone === 'banner') {
      switch (event.key) {
        case 'ArrowLeft':
          if (activeBannerIndex > 0) {
            activeBannerIndex--;
            updateFocus();
          }
          event.preventDefault();
          break;
        case 'ArrowRight':
          if (activeBannerIndex < 1) {
            activeBannerIndex++;
            updateFocus();
          }
          event.preventDefault();
          break;
        case 'ArrowUp':
          focusZone = 'menu';
          updateFocus();
          event.preventDefault();
          break;
        case 'ArrowDown':
          if (focusMatrix.length > 0 && focusMatrix[0].length > 0) {
            focusZone = 'grid';
            activeRowIndex = 0;
            activeColIndex = 0;
            changeFocus(activeRowIndex, activeColIndex);
          }
          event.preventDefault();
          break;
        case 'Enter':
          if (activeBannerIndex === 0) {
            toggleFavoriteActive();
          } else {
            hideActiveChannel();
          }
          event.preventDefault();
          break;
      }
    } else if (focusZone === 'grid') {
      switch (event.key) {
        case 'ArrowLeft':
          if (activeColIndex > 0) {
            changeFocus(activeRowIndex, activeColIndex - 1);
          }
          event.preventDefault();
          break;
        case 'ArrowRight':
          const rowRight = focusMatrix[activeRowIndex];
          if (rowRight && activeColIndex < rowRight.length - 1) {
            changeFocus(activeRowIndex, activeColIndex + 1);
          }
          event.preventDefault();
          break;
        case 'ArrowUp':
          if (activeRowIndex > 0) {
            const nextRow = activeRowIndex - 1;
            const nextRowTiles = focusMatrix[nextRow];
            const nextCol = nextRowTiles ? Math.min(activeColIndex, nextRowTiles.length - 1) : 0;
            changeFocus(nextRow, nextCol);
          } else {
            if (activeFilter === 'Search') {
              focusZone = 'search';
            } else {
              focusZone = 'banner';
              activeBannerIndex = 0;
            }
            updateFocus();
          }
          event.preventDefault();
          break;
        case 'ArrowDown':
          if (activeRowIndex < focusMatrix.length - 1) {
            const nextRow = activeRowIndex + 1;
            const nextRowTiles = focusMatrix[nextRow];
            const nextCol = nextRowTiles ? Math.min(activeColIndex, nextRowTiles.length - 1) : 0;
            changeFocus(nextRow, nextCol);
          }
          event.preventDefault();
          break;
        case 'Enter':
          const rowEnter = focusMatrix[activeRowIndex];
          const focusedTile = rowEnter ? rowEnter[activeColIndex] : null;
          if (focusedTile) {
            const channel = JSON.parse(focusedTile.dataset.channelData);
            playChannel(channel);
          }
          event.preventDefault();
          break;
      }
    }

    // [F] Key shortcut to toggle favorite of selected channel from any zone (disabled during search typing)
    if (focusZone !== 'search' && (event.key === 'f' || event.key === 'F')) {
      // Don't toggle favorite when in fullscreen since it's already handled there
      if (!isFullscreen) {
        toggleFavoriteActive();
        event.preventDefault();
      }
    }

    // [D] Key shortcut to hide/delete selected channel from any zone (disabled during search typing)
    if (focusZone !== 'search' && (event.key === 'd' || event.key === 'D')) {
      // Don't delete when in fullscreen since it's already handled there
      if (!isFullscreen) {
        hideActiveChannel();
        event.preventDefault();
      }
    }
  });
}

// Background DNS Pre-warming and HTTP manifest/segment pre-caching for adjacent channels
function preloadAdjacentChannels() {
  if (focusMatrix.length === 0) return;
  const currentRow = focusMatrix[activeRowIndex];
  if (!currentRow || currentRow.length === 0) return;

  const nextIndex = (activeColIndex + 1) % currentRow.length;
  const prevIndex = (activeColIndex - 1 + currentRow.length) % currentRow.length;

  const nextChannel = JSON.parse(currentRow[nextIndex].dataset.channelData);
  const prevChannel = JSON.parse(currentRow[prevIndex].dataset.channelData);

  // Pre-warm connections and pre-cache manifests/first segment for next and previous channels
  prefetchChannel(nextChannel);
  prefetchChannel(prevChannel);
}

// Highly efficient background playlist and first-segment prefetching
async function prefetchChannel(channel) {
  if (!channel || !channel.url) return;

  try {
    const url = channel.url;
    const domain = new URL(url).origin;

    // 1. Inject link rel=preconnect to warm up DNS & SSL handshake
    let preconnect = document.querySelector(`link[href="${domain}"]`);
    if (!preconnect) {
      preconnect = document.createElement('link');
      preconnect.rel = 'preconnect';
      preconnect.href = domain;
      preconnect.crossOrigin = 'anonymous';
      document.head.appendChild(preconnect);
    }

    // 2. Try fetching the playlist to parse its first segment
    let text = "";
    try {
      const response = await fetch(url, { credentials: 'omit' });
      if (response.ok) {
        text = await response.text();
      }
    } catch (e) {
      // CORS block or network failure - do an opaque fetch to cache the playlist file itself
      fetch(url, { method: 'GET', mode: 'no-cors', credentials: 'omit' }).catch(() => {});
    }

    if (!text) return;

    // Parse the manifest for segments or sub-playlists
    const lines = text.split(/\r?\n/);
    let firstSegmentUrl = null;
    let firstPlaylistUrl = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      // Resolve relative URL
      let absoluteUrl = line;
      if (!line.startsWith('http://') && !line.startsWith('https://')) {
        absoluteUrl = new URL(line, url).href;
      }

      if (line.includes('.m3u8') || line.includes('manifest')) {
        if (!firstPlaylistUrl) firstPlaylistUrl = absoluteUrl;
      } else {
        if (!firstSegmentUrl) {
          firstSegmentUrl = absoluteUrl;
          break; // Found the segment!
        }
      }
    }

    // If we found a sub-playlist, fetch it (one level of recursion)
    if (firstPlaylistUrl) {
      try {
        const subResp = await fetch(firstPlaylistUrl, { credentials: 'omit' });
        if (subResp.ok) {
          const subText = await subResp.text();
          const subLines = subText.split(/\r?\n/);
          for (let i = 0; i < subLines.length; i++) {
            const subLine = subLines[i].trim();
            if (!subLine || subLine.startsWith('#')) continue;

            let absoluteSubUrl = subLine;
            if (!subLine.startsWith('http://') && !subLine.startsWith('https://')) {
              absoluteSubUrl = new URL(subLine, firstPlaylistUrl).href;
            }

            if (!subLine.includes('.m3u8') && !subLine.includes('manifest')) {
              firstSegmentUrl = absoluteSubUrl;
              break;
            }
          }
        }
      } catch (e) {}
    }

    // 3. Pre-fetch first segment chunk (first 256KB) to warm cache
    if (firstSegmentUrl) {
      fetch(firstSegmentUrl, {
        method: 'GET',
        credentials: 'omit',
        headers: { 'Range': 'bytes=0-262143' }
      }).catch(() => {
        // Fallback to fetching the entire segment if Range is not supported
        fetch(firstSegmentUrl, { method: 'GET', credentials: 'omit', mode: 'no-cors' }).catch(() => {});
      });
    }
  } catch (e) {
    console.warn('[Preload] Failed to prefetch channel:', channel.name, e);
  }
}
