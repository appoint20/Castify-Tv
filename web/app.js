const PLAYLISTS = [
  { name: 'Germany', url: 'https://iptv-org.github.io/iptv/countries/de.m3u' },
  { name: 'Austria', url: 'https://iptv-org.github.io/iptv/countries/at.m3u' },
  { name: 'India', url: 'https://iptv-org.github.io/iptv/countries/in.m3u' }
];

const FALLBACK_PLAYLIST = [
  { name: "Sintel HD Movie (CORS OK)", url: "https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8", group: "Test Streams", logo: "https://upload.wikimedia.org/wikipedia/commons/e/e8/Sintel_logo.png" },
  { name: "Big Buck Bunny (CORS OK)", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", group: "Test Streams", logo: "https://upload.wikimedia.org/wikipedia/commons/c/c5/Big_Buck_Bunny_Logo.svg" },
  { name: "Tears of Steel (CORS OK)", url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8", group: "Test Streams", logo: "https://upload.wikimedia.org/wikipedia/commons/3/30/Tears_of_Steel_logo.svg" },
  { name: "DW Deutsch", url: "https://dwamdstream102-lh.akamaihd.net/i/dwamd_de@403565/master.m3u8", group: "Germany - News", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Deutsche_Welle_logo.svg/320px-Deutsche_Welle_logo.svg.png" },
  { name: "ZDF Info (Geo-blocked)", url: "https://zdf-hls-15.akamaized.net/hls/live/2019278/zdfinfo/master.m3u8", group: "Germany - Documentary", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Zdf_info_logo.svg/320px-Zdf_info_logo.svg.png" },
  { name: "India Today Live", url: "https://lm-india-today.akamaized.net/hls/live/2009855/indiatoday/master.m3u8", group: "India - News", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/India_Today_logo.svg/320px-India_Today_logo.svg.png" },
  { name: "9XM Bollywood Music", url: "https://rts-live.yacast.net/rts_fm_300.m3u8", group: "India - Music", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/9XM_logo.svg/320px-9XM_logo.svg.png" }
];

let allChannels = [];
let groupedCategories = {};
let focusMatrix = []; // 2D array: [ [tileEl, tileEl], [tileEl, tileEl] ]
let activeRowIndex = 0;
let activeColIndex = 0;
let hlsInstance = null;

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  setupKeyboardNavigation();
  loadPlaylists();
});

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
    allChannels = FALLBACK_PLAYLIST;
  }

  status.innerText = 'Organizing channels into rows...';
  groupChannels();
  renderGrid();
  
  // Hide loader
  loader.classList.add('hidden');
  
  // Focus first tile
  focusFirstAvailableTile();
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
      
      currentMeta = {
        name: displayName,
        group: groupMatch ? `${countryName} - ${groupMatch[1]}` : `${countryName} - General`,
        logo: logoMatch ? logoMatch[1] : ''
      };
    } else if (!line.startsWith('#')) {
      if (currentMeta) {
        channels.push({
          ...currentMeta,
          url: line
        });
        currentMeta = null;
      }
    }
  }
  return channels;
}

// Group Channels by category
function groupChannels() {
  groupedCategories = {};
  allChannels.forEach(channel => {
    const category = channel.group || 'General';
    if (!groupedCategories[category]) {
      groupedCategories[category] = [];
    }
    groupedCategories[category].push(channel);
  });
}

// Render Netflix-style categories and horizontal logo rows
function renderGrid() {
  const container = document.getElementById('categories-container');
  container.innerHTML = '';
  
  focusMatrix = [];
  let rowIndex = 0;

  // Sort categories by size (largest first)
  const sortedCategories = Object.keys(groupedCategories).sort(
    (a, b) => groupedCategories[b].length - groupedCategories[a].length
  );

  sortedCategories.forEach(categoryName => {
    const channels = groupedCategories[categoryName];
    if (channels.length === 0) return;

    // Create Category Row
    const rowDiv = document.createElement('div');
    rowDiv.className = 'category-row';
    rowDiv.id = `row-${rowIndex}`;

    // Category Title
    const titleH2 = document.createElement('h2');
    titleH2.className = 'category-title';
    titleH2.innerText = categoryName;
    rowDiv.appendChild(titleH2);

    // Horizontal Scroll Container (LOGOS ONLY)
    const tilesWrapper = document.createElement('div');
    tilesWrapper.className = 'tiles-wrapper';
    
    const rowTiles = [];

    channels.forEach((channel, colIndex) => {
      const tile = document.createElement('div');
      tile.className = 'channel-tile';
      tile.dataset.rowIndex = rowIndex;
      tile.dataset.colIndex = colIndex;
      tile.dataset.channelData = JSON.stringify(channel);

      // Channel Logo ONLY (no text)
      if (channel.logo) {
        const img = document.createElement('img');
        img.className = 'tile-logo';
        img.src = channel.logo;
        img.alt = channel.name;
        img.onerror = () => { 
          // Fallback: show text if logo fails
          tile.innerHTML = '<span style="font-size: 0.8em; text-align: center; padding: 8px;">' + channel.name.substring(0, 3) + '</span>';
        };
        tile.appendChild(img);
      } else {
        // Fallback text
        const nameSpan = document.createElement('span');
        nameSpan.className = 'tile-name';
        nameSpan.innerText = channel.name.substring(0, 3);
        tile.appendChild(nameSpan);
      }

      // Click handler
      tile.addEventListener('click', () => {
        changeFocus(parseInt(tile.dataset.rowIndex), parseInt(tile.dataset.colIndex));
        playChannel(channel);
      });

      tilesWrapper.appendChild(tile);
      rowTiles.push(tile);
    });

    rowDiv.appendChild(tilesWrapper);
    container.appendChild(rowDiv);

    focusMatrix.push(rowTiles);
    rowIndex++;
  });
}

// D-Pad Focus Manager
function focusFirstAvailableTile() {
  if (focusMatrix.length > 0 && focusMatrix[0].length > 0) {
    changeFocus(0, 0);
  }
}

function changeFocus(rowIndex, colIndex) {
  // Bound check
  if (rowIndex < 0 || rowIndex >= focusMatrix.length) return;
  if (colIndex < 0 || colIndex >= focusMatrix[rowIndex].length) return;

  // Unfocus previous element
  const prevFocused = document.querySelector('.channel-tile.focused');
  if (prevFocused) {
    prevFocused.classList.remove('focused');
  }

  // Update indices
  activeRowIndex = rowIndex;
  activeColIndex = colIndex;

  // Focus new element
  const currentFocused = focusMatrix[activeRowIndex][activeColIndex];
  currentFocused.classList.add('focused');

  // Trigger auto scroll to keep focused element visible
  currentFocused.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
    inline: 'center'
  });

  // Keep active category row vertically visible
  const activeRowEl = document.getElementById(`row-${activeRowIndex}`);
  if (activeRowEl) {
    activeRowEl.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    });
  }

  // Update Banner Info
  const channelData = JSON.parse(currentFocused.dataset.channelData);
  updateBanner(channelData);
}

function updateBanner(channel) {
  document.getElementById('current-name').innerText = channel.name;
  document.getElementById('current-category').innerText = channel.group;
  document.getElementById('current-description').innerText = `Live HLS Stream URL: ${channel.url}`;
  
  const currentLogo = document.getElementById('current-logo');
  if (channel.logo) {
    currentLogo.src = channel.logo;
    currentLogo.style.display = 'block';
    currentLogo.onerror = () => { currentLogo.style.display = 'none'; };
  } else {
    currentLogo.style.display = 'none';
  }
}

// Media Playback (Hls.js with native fallback)
function playChannel(channel) {
  const video = document.getElementById('player');
  const overlay = document.getElementById('player-overlay');
  const msg = document.getElementById('overlay-message');
  let loadStartTime = Date.now();

  overlay.classList.remove('hidden');
  msg.innerText = `🎬 Starting ${channel.name}...`;

  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  if (Hls.isSupported()) {
    hlsInstance = new Hls({
      enableWorker: true,
      // Fast startup config for TV streaming
      maxBufferLength: 20, // Start playback faster with lower buffer
      maxMaxBufferLength: 60, // Max caching buffer to avoid excessive memory use
      targetMaxBufferLength: 25, // Target buffer level
      lowLatencyMode: false,
      highBufferWatchdogPeriod: 5, // Check buffer frequently
      nudgeOffset: 0.15, // Small nudge to help seeking
      maxBufferHole: 0.5, // Recover from small buffer holes
      // Adaptive bitrate config
      abrEwmaDefaultEstimate: 800000, // Start with 0.8 Mbps for faster first segment
      abrEwmaFastMultiplier: 1.5, // Quickly ramp up if bandwidth available
      abrEwmaSlowMultiplier: 0.4, // Conservative downshift for drops
      abrBandWidthFraction: 0.8, // Use 80% of detected bandwidth
      // Playback optimization
      capLevelToPlayerSize: true,
      autoStartLoad: true,
      startLevel: -1, // Auto-select level
      levelLoadingTimeOut: 10000, // 10s timeout for segment load
      manifestLoadingTimeOut: 20000 // 20s timeout for manifest load
    });
    hlsInstance.loadSource(channel.url);
    hlsInstance.attachMedia(video);
    
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      const loadTime = ((Date.now() - loadStartTime) / 1000).toFixed(1);
      msg.innerText = `⏳ Buffering (${loadTime}s)...`;
      video.play().then(() => {
        overlay.classList.add('hidden');
      }).catch(err => {
        console.warn('Playback blocked by auto-play policy:', err);
        msg.innerText = 'Tap to play';
      });
    });
    
    hlsInstance.on(Hls.Events.BUFFER_CREATED, () => {
      msg.innerText = `⏳ Loading stream...`;
    });
    
    hlsInstance.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
      console.log(`Video quality: ${hlsInstance.levels[data.level].height}p`);
    });
    
    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      console.warn('HLS error:', data);
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.log('Network error, retrying...');
            msg.innerText = `📡 Network issue, retrying...`;
            setTimeout(() => {
              if (hlsInstance) hlsInstance.startLoad();
            }, 1000);
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log('Media error, recovering...');
            msg.innerText = `⚠️ Media error, recovering...`;
            hlsInstance.recoverMediaError();
            break;
          default:
            console.error('Unrecoverable error:', data.details);
            msg.innerText = `❌ Cannot play: ${data.details}`;
            hlsInstance.destroy();
            hlsInstance = null;
            break;
        }
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Native Apple HLS (Safari, iOS, and LG webOS)
    msg.innerText = `🎬 Starting ${channel.name}...`;
    video.src = channel.url;
    
    video.addEventListener('loadedmetadata', () => {
      const loadTime = ((Date.now() - loadStartTime) / 1000).toFixed(1);
      console.log(`Stream loaded in ${loadTime}s`);
      video.play().then(() => {
        overlay.classList.add('hidden');
      }).catch(err => {
        console.warn('Auto-play blocked:', err);
        msg.innerText = 'Tap to play';
      });
    }, { once: true });
    
    video.addEventListener('error', () => {
      console.error('Native player error:', video.error ? video.error.code : 'unknown');
      msg.innerText = `❌ Cannot play: Stream unavailable or geo-blocked`;
    });
    
    video.load();
  } else {
    msg.innerText = '❌ HLS not supported in this browser';
  }
}

// Keyboard / Remote D-Pad key events mapping
function setupKeyboardNavigation() {
  document.addEventListener('keydown', (event) => {
    switch (event.key) {
      case 'ArrowLeft':
        if (activeColIndex > 0) {
          changeFocus(activeRowIndex, activeColIndex - 1);
        }
        event.preventDefault();
        break;
      case 'ArrowRight':
        if (activeColIndex < focusMatrix[activeRowIndex].length - 1) {
          changeFocus(activeRowIndex, activeColIndex + 1);
        }
        event.preventDefault();
        break;
      case 'ArrowUp':
        if (activeRowIndex > 0) {
          const nextRow = activeRowIndex - 1;
          const nextCol = Math.min(activeColIndex, focusMatrix[nextRow].length - 1);
          changeFocus(nextRow, nextCol);
        }
        event.preventDefault();
        break;
      case 'ArrowDown':
        if (activeRowIndex < focusMatrix.length - 1) {
          const nextRow = activeRowIndex + 1;
          const nextCol = Math.min(activeColIndex, focusMatrix[nextRow].length - 1);
          changeFocus(nextRow, nextCol);
        }
        event.preventDefault();
        break;
      case 'Enter':
        const focusedEl = focusMatrix[activeRowIndex][activeColIndex];
        if (focusedEl) {
          const channelData = JSON.parse(focusedEl.dataset.channelData);
          playChannel(channelData);
        }
        event.preventDefault();
        break;
      case 'f':
      case 'F':
        toggleFullscreen();
        event.preventDefault();
        break;
      case 'Escape':
        exitFullscreen();
        event.preventDefault();
        break;
    }
  });
  
  // Video player fullscreen support
  const video = document.getElementById('player');
  video.addEventListener('dblclick', toggleFullscreen);
  
  // WebOS remote button support
  document.addEventListener('webos-back', exitFullscreen);
}

// Fullscreen Functions
function toggleFullscreen() {
  const video = document.getElementById('player');
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    exitFullscreen();
  } else {
    enterFullscreen(video);
  }
}

function enterFullscreen(element) {
  if (element.requestFullscreen) {
    element.requestFullscreen().catch(err => console.log('Fullscreen error:', err));
  } else if (element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen();
  } else if (element.mozRequestFullScreen) {
    element.mozRequestFullScreen();
  } else if (element.msRequestFullscreen) {
    element.msRequestFullscreen();
  }
}

function exitFullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen().catch(err => console.log('Exit fullscreen error:', err));
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  } else if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  }
}
