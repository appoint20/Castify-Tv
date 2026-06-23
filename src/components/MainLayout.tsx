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
}

/**
 * `<MainLayout />` acts as the master coordinator dashboard.
 * Implements a premium split-screen design (Banner + Video on top, rows on bottom).
 * Supports D-Pad controls for fullscreen toggles and hardware BACK button overrides.
 */
export const MainLayout: React.FC<MainLayoutProps> = ({ categories }) => {
  const { activeChannel, stopPlayback } = useMediaEngine();
  
  // Track currently D-Pad focused channel to display details in the banner
  const [focusedChannel, setFocusedChannel] = useState<Channel | null>(null);
  
  // Track fullscreen mode
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenBtnFocused, setFullscreenBtnFocused] = useState(false);

  // Set the first channel as focused initially if available
  useEffect(() => {
    if (categories.length > 0 && categories[0].channels.length > 0 && !focusedChannel) {
      setFocusedChannel(categories[0].channels[0]);
    }
  }, [categories, focusedChannel]);

  // Intercept D-Pad BACK button to exit fullscreen mode or stop playback
  useEffect(() => {
    const handleBackButton = () => {
      if (isFullscreen) {
        setIsFullscreen(false);
        return true; // Prevent default back action
      }
      if (activeChannel) {
        stopPlayback();
        return true; // Handled
      }
      return false; // Let OS handle app exit
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

  // Decide what channel info to display in the header banner
  const bannerChannel = focusedChannel || activeChannel || (categories[0]?.channels[0]);

  return (
    <View style={styles.container}>
      {isFullscreen && activeChannel ? (
        // Fullscreen Mode
        <View style={StyleSheet.absoluteFill}>
          <VideoPlayer channel={activeChannel} />
          {/* Subtle floating overlay to guide TV users */}
          <View style={styles.fullscreenOverlay}>
            <Text style={styles.fullscreenOverlayText}>
              Press BACK on your remote to exit Fullscreen
            </Text>
          </View>
        </View>
      ) : (
        // Dashboard Mode (Split Screen)
        <View style={styles.dashboardContainer}>
          {/* Top Panel (Banner + Player) */}
          <View style={styles.topPanel}>
            {/* Left: Metadata Banner */}
            <View style={styles.bannerContainer}>
              {bannerChannel ? (
                <View style={styles.metaWrapper}>
                  <View style={styles.badgeRow}>
                    <View style={styles.liveBadge}>
                      <Text style={styles.liveBadgeText}>LIVE</Text>
                    </View>
                    <View style={styles.hdBadge}>
                      <Text style={styles.hdBadgeText}>FHD 1080P</Text>
                    </View>
                  </View>
                  <Text style={styles.bannerChannelName} numberOfLines={2}>
                    {bannerChannel.name}
                  </Text>
                  <Text style={styles.bannerCategoryName}>
                    Category: {bannerChannel.group}
                  </Text>
                  <Text style={styles.bannerDescription}>
                    Now playing live broadcast. Switch channels below by highlighting and pressing OK/Select on your D-pad controller.
                  </Text>
                </View>
              ) : (
                <View style={styles.emptyMetaWrapper}>
                  <Text style={styles.emptyMetaTitle}>Castify TV</Text>
                  <Text style={styles.emptyMetaSubtitle}>
                    Load a playlist to start watching
                  </Text>
                </View>
              )}
            </View>

            {/* Right: Live Video Stream Viewport */}
            <View style={styles.playerContainer}>
              {activeChannel ? (
                <View style={styles.playerWrapper}>
                  <VideoPlayer channel={activeChannel} />
                  
                  {/* Floating Video Action Controls (D-pad accessible) */}
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
                    <Text style={styles.controlButtonText}>🖵 Go Fullscreen</Text>
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
          </View>

          {/* Bottom Panel: Vertical Row Categories */}
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
    backgroundColor: '#141414', // Deep graphite Netflix background
  },
  dashboardContainer: {
    flex: 1,
  },
  topPanel: {
    height: '42%',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    backgroundColor: '#0c0c0c',
  },
  bannerContainer: {
    flex: 5, // 50% width
    justifyContent: 'center',
    padding: 24,
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
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 8,
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  hdBadge: {
    borderWidth: 1,
    borderColor: '#9CA3AF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 3,
  },
  hdBadgeText: {
    color: '#9CA3AF',
    fontSize: 9,
    fontWeight: '700',
  },
  bannerChannelName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  bannerCategoryName: {
    color: '#E50914',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  bannerDescription: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 18,
    maxWidth: '90%',
  },
  emptyMetaWrapper: {
    justifyContent: 'center',
  },
  emptyMetaTitle: {
    color: '#E50914',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  emptyMetaSubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 8,
  },
  playerContainer: {
    flex: 5, // 50% width
    backgroundColor: '#000000',
    borderLeftWidth: 1,
    borderLeftColor: '#262626',
  },
  playerWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  noActiveStream: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#080808',
  },
  noActiveStreamText: {
    color: '#D1D5DB',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  noActiveStreamSubtext: {
    color: '#4B5563',
    fontSize: 11,
    textAlign: 'center',
  },
  controlButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#404040',
    zIndex: 20,
  },
  controlButtonFocused: {
    borderColor: '#E50914',
    backgroundColor: '#E50914',
    transform: [{ scale: 1.05 }],
  },
  controlButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  bottomPanel: {
    height: '58%',
    backgroundColor: '#141414',
  },
  bottomPanelContent: {
    paddingVertical: 12,
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
