import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  BackHandler,
  Pressable,
  Platform,
} from 'react-native';
import { Channel, ChannelGroup } from '../types/iptv';
import { useMediaEngine } from '../hooks/useMediaEngine';
import { VideoPlayer } from './VideoPlayer';
import { ChannelRow } from './ChannelRow';

interface MainLayoutProps {
  /** Map of categorized channels */
  categories: ChannelGroup[];
  favoriteUrls: string[];
  hiddenUrls: string[];
  onToggleFavorite: (url: string) => void;
  onHideChannel: (url: string) => void;
}

/**
 * `<MainLayout />` is a pixel-faithful Netflix clone for Smart TV.
 *
 * Layout structure (Netflix TV app):
 *  ┌─────────────────────────────────────────────────┐
 *  │  NAV BAR (logo + menu items)                     │
 *  ├──────────────────────────┬──────────────────────┤
 *  │  LEFT (metadata banner)   │  RIGHT (video)       │
 *  │  channel name, badges,    │  live stream player  │
 *  │  description, actions     │                      │
 *  ├──────────────────────────┴──────────────────────┤
 *  │  ROWS (Netflix film-card rails)                 │
 *  │  ► Popular • Favorites • News • Music ...       │
 *  └─────────────────────────────────────────────────┘
 *
 * On startup: 9XM Music is auto-selected & playing on the right.
 */
export const MainLayout: React.FC<MainLayoutProps> = ({
  categories,
  favoriteUrls,
  hiddenUrls,
  onToggleFavorite,
  onHideChannel,
}) => {
  const { activeChannel, playChannel, stopPlayback } = useMediaEngine();
  
  const [focusedChannel, setFocusedChannel] = useState<Channel | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenBtnFocused, setFullscreenBtnFocused] = useState(false);
  const [favBtnFocused, setFavBtnFocused] = useState(false);
  const [hideBtnFocused, setHideBtnFocused] = useState(false);

  // ─── Startup Autoplay: ALWAYS start with 9XM Music ───
  useEffect(() => {
    if (categories.length > 0 && !activeChannel) {
      let target: Channel | null = null;
      
      for (const group of categories) {
        const found = group.channels.find(c => c.name && c.name.toLowerCase().includes('9xm'));
        if (found) { target = found; break; }
      }
      if (!target) {
        for (const group of categories) {
          const found = group.channels.find(c => c.name && c.name.toLowerCase().includes('zee music'));
          if (found) { target = found; break; }
        }
      }
      if (!target) {
        for (const group of categories) {
          const found = group.channels.find(c => c.name && c.name.toLowerCase().includes('b4u music'));
          if (found) { target = found; break; }
        }
      }
      if (!target && categories[0].channels.length > 0) {
        target = categories[0].channels[0];
      }
      
      if (target) {
        playChannel(target);
        setFocusedChannel(target);
      }
    }
  }, [categories, activeChannel, playChannel]);

  // Safety fallback
  useEffect(() => {
    if (categories.length > 0 && categories[0].channels.length > 0 && !focusedChannel) {
      setFocusedChannel(categories[0].channels[0]);
    }
  }, [categories, focusedChannel]);

  // ─── D-Pad BACK button ───
  useEffect(() => {
    const handleBackButton = () => {
      if (isFullscreen) {
        setIsFullscreen(false);
        return true;
      }
      if (activeChannel) {
        stopPlayback();
        return true;
      }
      return false;
    };

    BackHandler.addEventListener('hardwareBackPress', handleBackButton);
    return () => {
      BackHandler.removeEventListener('hardwareBackPress', handleBackButton);
    };
  }, [isFullscreen, activeChannel, stopPlayback]);

  const handleChannelFocused = useCallback((channel: Channel) => {
    setFocusedChannel(channel);
  }, []);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  const handleHideActive = () => {
    const targetChannel = focusedChannel || activeChannel || (categories[0]?.channels[0]);
    if (!targetChannel) return;
    
    if (activeChannel && activeChannel.url === targetChannel.url) {
      stopPlayback();
    }
    
    onHideChannel(targetChannel.url);
    
    let nextChannel: Channel | null = null;
    for (const group of categories) {
      const idx = group.channels.findIndex(c => c.url === targetChannel.url);
      if (idx !== -1) {
        if (idx + 1 < group.channels.length) {
          nextChannel = group.channels[idx + 1];
        } else if (idx - 1 >= 0) {
          nextChannel = group.channels[idx - 1];
        }
        break;
      }
    }
    
    if (nextChannel) {
      setFocusedChannel(nextChannel);
      playChannel(nextChannel);
    } else {
      const firstGroup = categories.find(g => g.channels.length > 0);
      if (firstGroup) {
        setFocusedChannel(firstGroup.channels[0]);
        playChannel(firstGroup.channels[0]);
      } else {
        setFocusedChannel(null);
      }
    }
  };

  const bannerChannel = focusedChannel || activeChannel || (categories[0]?.channels[0]);

  return (
    <View style={styles.container}>
      {isFullscreen && activeChannel ? (
        // ─── Fullscreen Mode ───
        <View style={StyleSheet.absoluteFill}>
          <VideoPlayer channel={activeChannel} />
          <View style={styles.fullscreenOverlay}>
            <Text style={styles.fullscreenOverlayText}>
              Press BACK on your remote to exit Fullscreen
            </Text>
          </View>
        </View>
      ) : (
        // ─── Netflix Dashboard ───
        <View style={styles.dashboardContainer}>
          {/* Top Navigation Bar (Netflix style) */}
          <View style={styles.navBar}>
            <Text style={styles.navLogo}>Castify<Text style={styles.navLogoAccent}>TV</Text></Text>
            <View style={styles.navMenu}>
              <Text style={[styles.navItem, styles.navItemActive]}>Home</Text>
              <Text style={styles.navItem}>Channels</Text>
              <Text style={styles.navItem}>Favorites</Text>
              <Text style={styles.navItem}>Movies</Text>
              <Text style={styles.navItem}>Music</Text>
            </View>
          </View>

          {/* Cinematic Hero Panel (Video Background with overlaid Metadata) */}
          <View style={styles.topPanel}>
            {/* 1. Live Video Stream Viewport (fills entire panel) */}
            <View style={styles.playerContainer}>
              {activeChannel ? (
                <View style={styles.playerWrapper}>
                  <VideoPlayer channel={activeChannel} />
                  
                  {/* Floating Fullscreen Control (bottom-right) */}
                  <Pressable
                    focusable={true}
                    onFocus={() => setFullscreenBtnFocused(true)}
                    onBlur={() => setFullscreenBtnFocused(false)}
                    onPress={toggleFullscreen}
                    style={[
                      styles.controlButton,
                      fullscreenBtnFocused && styles.controlButtonFocused,
                    ]}
                  >
                    <Text style={styles.controlButtonText}>⛶ Fullscreen</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.noActiveStream}>
                  <Text style={styles.noActiveStreamText}>No Stream Selected</Text>
                  <Text style={styles.noActiveStreamSubtext}>
                    Highlight a tile below and press OK to watch
                  </Text>
                </View>
              )}
            </View>

            {/* 2. Overlaid Metadata Banner (bottom-left) */}
            <View style={styles.bannerContainer}>
              {bannerChannel ? (
                <View style={styles.metaWrapper}>
                  <View style={styles.badgeRow}>
                    <View style={styles.liveBadge}>
                      <Text style={styles.liveBadgeText}>● LIVE</Text>
                    </View>
                    <View style={styles.hdBadge}>
                      <Text style={styles.hdBadgeText}>FHD 1080P</Text>
                    </View>
                  </View>
                  <Text style={styles.bannerChannelName} numberOfLines={2}>
                    {bannerChannel.name}
                  </Text>
                  <Text style={styles.bannerCategoryName}>
                    {bannerChannel.group}
                  </Text>
                  <Text style={styles.bannerDescription} numberOfLines={3}>
                    Now playing live broadcast. Use the D-Pad to browse channels below and press OK to watch.
                  </Text>
                  
                  {/* Banner Action Buttons */}
                  <View style={styles.bannerActions}>
                    <Pressable
                      focusable={true}
                      onFocus={() => setFavBtnFocused(true)}
                      onBlur={() => setFavBtnFocused(false)}
                      onPress={() => onToggleFavorite(bannerChannel.url)}
                      style={[
                        styles.actionButton,
                        favBtnFocused && styles.actionButtonFocused,
                      ]}
                    >
                      <Text style={styles.actionButtonText}>
                        {favoriteUrls.includes(bannerChannel.url) ? '✓ My Favorites' : '+ My Favorites'}
                      </Text>
                    </Pressable>
                    <Pressable
                      focusable={true}
                      onFocus={() => setHideBtnFocused(true)}
                      onBlur={() => setHideBtnFocused(false)}
                      onPress={handleHideActive}
                      style={[
                        styles.actionButton,
                        styles.actionButtonSecondary,
                        hideBtnFocused && styles.actionButtonFocused,
                      ]}
                    >
                      <Text style={styles.actionButtonText}>✕ Hide Channel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyMetaWrapper}>
                  <Text style={styles.emptyMetaTitle}>Castify<Text style={{color: '#FFFFFF'}}>TV</Text></Text>
                  <Text style={styles.emptyMetaSubtitle}>
                    Load a playlist to start watching
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Netflix-Style Category Rows */}
          <ScrollView
            style={styles.bottomPanel}
            contentContainerStyle={styles.bottomPanelContent}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={Platform.OS === 'android'}
          >
            {categories.map((group) => (
              <ChannelRow
                key={group.title}
                title={group.title}
                channels={group.channels}
                onChannelFocused={handleChannelFocused}
              />
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e2a35', // Dark navy/steel theme
  },
  dashboardContainer: {
    flex: 1,
  },
  
  // ─── Top Navigation Bar ───
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    marginTop: 8,
    paddingHorizontal: 24,
    backgroundColor: '#1e2a35',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  navLogo: {
    color: '#bdd5ea', // Custom soft blue accent
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  navLogoAccent: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  navMenu: {
    flexDirection: 'row',
    marginLeft: 36,
  },
  navItem: {
    color: '#8a9aa8', // Soft slate gray
    fontSize: 15,
    fontWeight: '600',
    marginRight: 28,
  },
  navItemActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  
  // ─── Cinematic Hero Panel ───
  topPanel: {
    height: '48%', // Cinematic sizing
    position: 'relative',
    backgroundColor: '#151f28',
    overflow: 'hidden',
  },
  playerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    zIndex: 1,
  },
  playerWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  bannerContainer: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    width: '50%',
    zIndex: 10,
  },
  metaWrapper: {
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  liveBadge: {
    backgroundColor: '#E50914',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    marginRight: 8,
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  hdBadge: {
    borderWidth: 1,
    borderColor: '#b8c8d4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },
  hdBadgeText: {
    color: '#b8c8d4',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  bannerChannelName: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 4,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 8,
  },
  bannerCategoryName: {
    color: '#bdd5ea',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 6,
  },
  bannerDescription: {
    color: '#e0e0e0',
    fontSize: 12,
    lineHeight: 16,
    maxWidth: '95%',
    marginBottom: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 6,
  },
  bannerActions: {
    flexDirection: 'row',
    marginTop: 2,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionButtonSecondary: {
    backgroundColor: 'rgba(109,109,110,0.5)',
  },
  actionButtonFocused: {
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    transform: [{ scale: 1.05 }],
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyMetaWrapper: {
    justifyContent: 'center',
  },
  emptyMetaTitle: {
    color: '#bdd5ea',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 6,
  },
  emptyMetaSubtitle: {
    color: '#b8c8d4',
    fontSize: 13,
    marginTop: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  noActiveStream: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#151f28',
  },
  noActiveStreamText: {
    color: '#8a9aa8',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  noActiveStreamSubtext: {
    color: '#4a5a68',
    fontSize: 12,
    textAlign: 'center',
  },
  controlButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    zIndex: 20,
  },
  controlButtonFocused: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.2)',
    transform: [{ scale: 1.05 }],
  },
  controlButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  
  // ─── Category Rows ───
  bottomPanel: {
    flex: 1,
    backgroundColor: '#1e2a35',
  },
  bottomPanelContent: {
    paddingTop: 16,
    paddingBottom: 40,
  },
  fullscreenOverlay: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  fullscreenOverlayText: {
    color: '#CCCCCC',
    fontSize: 12,
    fontWeight: '500',
  },
});
