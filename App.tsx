import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  NativeModules,
} from 'react-native';
import { MediaEngineProvider } from './src/hooks/useMediaEngine';
import { parseM3UAsync, ParseProgress } from './src/parsers/m3uParser';
import { Channel, ChannelGroup } from './src/types/iptv';
import { MainLayout } from './src/components/MainLayout';

const { CastingModule } = NativeModules;

// Mock M3U Playlist containing real, open HLS streams for TV testing, along with a broken link to verify error recovery.
const MOCK_PLAYLIST = `
#EXTM3U
#EXTINF:-1 tvg-id="DW_Deutsch" tvg-name="DW Deutsch" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Deutsche_Welle_logo.svg/320px-Deutsche_Welle_logo.svg.png" group-title="News",DW Deutsch (German News)
https://dwamdstream102-lh.akamaihd.net/i/dwamd_de@403565/master.m3u8

#EXTINF:-1 tvg-id="IndiaToday" tvg-name="India Today" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/India_Today_logo.svg/320px-India_Today_logo.svg.png" group-title="News",India Today Live (Indian News)
https://lm-india-today.akamaized.net/hls/live/2009855/indiatoday/master.m3u8

#EXTINF:-1 tvg-id="ZDF_Info" tvg-name="ZDF Info" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Zdf_info_logo.svg/320px-Zdf_info_logo.svg.png" group-title="History & Documentaries",ZDF Info (German Doc)
https://zdf-hls-15.akamaized.net/hls/live/2019278/zdfinfo/master.m3u8

#EXTINF:-1 tvg-id="DD_National" tvg-name="DD National" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Doordarshan_logo.svg/320px-Doordarshan_logo.svg.png" group-title="History & Documentaries",DD National Test (Indian Culture)
https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8

#EXTINF:-1 tvg-id="Netzkino" tvg-name="Netzkino Germany" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/a/ac/Netzkino_logo.png" group-title="Movies",Netzkino Germany (German HLS Movie)
https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8

#EXTINF:-1 tvg-id="IndianCinema" tvg-name="Indian Cinema" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Indian_Cinema_Logo.svg/320px-Indian_Cinema_Logo.svg.png" group-title="Movies",Indian Cinema Classic (Indian Movie)
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8

#EXTINF:-1 tvg-id="WDR_Music" tvg-name="WDR Fernsehen" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/WDR_logo.svg/320px-WDR_logo.svg.png" group-title="Music",WDR Fernsehen (German Music)
https://wdr_fs_wdrtv.akamaized.net/hls/live/2020111/wdrtv/master.m3u8

#EXTINF:-1 tvg-id="9XM" tvg-name="9XM Bollywood" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/9XM_logo.svg/320px-9XM_logo.svg.png" group-title="Music",9XM Bollywood Music (Indian Music)
https://rts-live.yacast.net/rts_fm_300.m3u8
`;

const PLAYLISTS = [
  { name: 'Germany', url: 'https://iptv-org.github.io/iptv/countries/de.m3u' },
  { name: 'Austria', url: 'https://iptv-org.github.io/iptv/countries/at.m3u' },
  { name: 'Hindi', url: 'https://iptv-org.github.io/iptv/languages/hin.m3u' }
];

export default function App() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isParsing, setIsParsing] = useState(true);
  const [favoriteUrls, setFavoriteUrls] = useState<string[]>([]);
  const [hiddenUrls, setHiddenUrls] = useState<string[]>([]);

  // Load saved favorites and hidden channels on mount
  useEffect(() => {
    async function loadSavedData() {
      try {
        if (CastingModule) {
          const favs = await CastingModule.getFavorites();
          const hids = await CastingModule.getHidden();
          setFavoriteUrls(JSON.parse(favs));
          setHiddenUrls(JSON.parse(hids));
        }
      } catch (e) {
        console.warn('[App] Failed to load saved data:', e);
      }
    }
    loadSavedData();
  }, []);

  useEffect(() => {
    async function loadPlaylists() {
      try {
        const allChannels: Channel[] = [];
        let hasLoadedAny = false;

        for (const playlist of PLAYLISTS) {
          try {
            console.log(`[App] Fetching playlist: ${playlist.name} from ${playlist.url}`);
            
            const response = await fetch(playlist.url);
            if (!response.ok) {
              throw new Error(`HTTP status ${response.status}`);
            }
            const content = await response.text();
            
            const parsed = await parseM3UAsync(
              content,
              () => {},
              200 // Process in chunks of 200 to keep UI responsive
            );
            
            // Annotate channels with their country origin and group title
            const annotated = parsed.map(c => ({
              ...c,
              group: c.group && c.group !== 'Other' ? `${playlist.name} - ${c.group}` : `${playlist.name} - General`
            }));
            
            allChannels.push(...annotated);
            hasLoadedAny = true;
          } catch (err) {
            console.warn(`[App] Failed to load playlist ${playlist.name}:`, err);
          }
        }

        // If all remote fetches failed (e.g. offline), use the mock fallback
        if (!hasLoadedAny || allChannels.length === 0) {
          console.log('[App] Offline or fetch failed, falling back to local playlist...');
          const parsed = await parseM3UAsync(
            MOCK_PLAYLIST,
            () => {},
            2
          );
          allChannels.push(...parsed);
        }

        // Inject guaranteed working channels for favorites
        const injectedChannels: Channel[] = [
          {
            id: 'injected_9xm',
            name: '9XM Music',
            url: 'https://epiconvh.akamaized.net/live/9XM/master.m3u8',
            group: 'Hindi - Music',
            logo: 'https://static.wikia.nocookie.net/logopedia/images/4/4c/9XM_logo.png'
          },
          {
            id: 'injected_zeemusic',
            name: 'Zee Music',
            url: 'https://f8e7y4c6.ssl.hwcdn.net/magic/playlist.m3u8',
            group: 'Hindi - Music',
            logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Zee_Music_Company_logo.png/320px-Zee_Music_Company_logo.png'
          },
          {
            id: 'injected_b4umusic',
            name: 'B4U Music',
            url: 'https://cdnb4u.wiseplayout.com/B4U_Music/master.m3u8',
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
        if (CastingModule) {
          const defaultsInitialized = await CastingModule.isDefaultsInitialized();
          if (!defaultsInitialized) {
            const defaultKeywords = ['9xm', 'zee music', 'b4u music', 'movies', 'favorit'];
            const initialFavs: string[] = [];
            allChannels.forEach(c => {
              if (c.name && c.url) {
                const lowerName = c.name.toLowerCase();
                const matches = defaultKeywords.some(keyword => lowerName.includes(keyword));
                if (matches && !initialFavs.includes(c.url)) {
                  initialFavs.push(c.url);
                }
              }
            });
            await CastingModule.saveFavorites(JSON.stringify(initialFavs));
            await CastingModule.setDefaultsInitialized();
            setFavoriteUrls(initialFavs);
          }
        }

        setChannels(allChannels);
        setIsParsing(false);
      } catch (err) {
        console.error('[App] Critical error in loadPlaylists:', err);
        setIsParsing(false);
      }
    }

    loadPlaylists();
  }, []);

  const handleToggleFavorite = useCallback((url: string) => {
    setFavoriteUrls((prev) => {
      const next = prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url];
      if (CastingModule) {
        CastingModule.saveFavorites(JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const handleHideChannel = useCallback((url: string) => {
    setHiddenUrls((prev) => {
      const next = prev.includes(url) ? prev : [...prev, url];
      if (CastingModule) {
        CastingModule.saveHidden(JSON.stringify(next));
      }
      return next;
    });
  }, []);

  // Compute categorized groups dynamically
  const groupedCategories = useMemo(() => {
    // 0. Filter out hidden/deleted channels
    const visibleChannels = channels.filter(c => !hiddenUrls.includes(c.url));

    // 1. Separate favorites into their own list
    const favoriteChannels = visibleChannels.filter(c => favoriteUrls.includes(c.url));

    // 2. Sort visible channels into standard categories
    const categoryMap: Record<string, Channel[]> = {};
    visibleChannels.forEach((chan) => {
      const cat = chan.group || 'General';
      if (!categoryMap[cat]) {
        categoryMap[cat] = [];
      }
      categoryMap[cat].push(chan);
    });

    const standardGroups: ChannelGroup[] = Object.keys(categoryMap)
      .map((title) => ({
        title,
        channels: categoryMap[title],
      }))
      .sort((a, b) => b.channels.length - a.channels.length);

    // 3. Create Favorites categories grouped by subcategory
    const favCategoryMap: Record<string, Channel[]> = {};
    favoriteChannels.forEach((chan) => {
      const cat = `★ Favorites - ${chan.group || 'General'}`;
      if (!favCategoryMap[cat]) {
        favCategoryMap[cat] = [];
      }
      favCategoryMap[cat].push(chan);
    });

    const favGroups: ChannelGroup[] = Object.keys(favCategoryMap)
      .map((title) => ({
        title,
        channels: favCategoryMap[title],
      }))
      .sort((a, b) => a.title.localeCompare(b.title));

    // Combine them: favorites first, then standard groups
    return [...favGroups, ...standardGroups];
  }, [channels, favoriteUrls, hiddenUrls]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <MediaEngineProvider>
        {isParsing ? (
          // Clean loader screen: Spinner and App Title only
          <View style={styles.splashContainer}>
            <ActivityIndicator size="large" color="#E50914" />
            <Text style={styles.splashTitle}>CastifyTV</Text>
          </View>
        ) : (
          // Main Smart TV coordinator layout
          <MainLayout
            categories={groupedCategories}
            favoriteUrls={favoriteUrls}
            hiddenUrls={hiddenUrls}
            onToggleFavorite={handleToggleFavorite}
            onHideChannel={handleHideChannel}
          />
        )}
      </MediaEngineProvider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  splashContainer: {
    flex: 1,
    backgroundColor: '#141414',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashTitle: {
    color: '#E5E7EB',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 3,
    marginTop: 20,
  },
});
