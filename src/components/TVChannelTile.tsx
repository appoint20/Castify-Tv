import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  Pressable,
  Animated,
  Platform,
  ViewStyle,
} from 'react-native';
import { Channel } from '../types/iptv';
import { useMediaEngine } from '../hooks/useMediaEngine';

interface TVChannelTileProps {
  /** The channel information to render */
  channel: Channel;
  /** Optional callback to notify when the tile gains focus */
  onTileFocused?: (channel: Channel) => void;
}

/**
 * Premium gradient palette inspired by Netflix's cinematic poster aesthetic.
 * Each channel gets a deterministic gradient based on its name hash.
 */
const GRADIENTS: { top: string; bottom: string }[] = [
  { top: '#1e3a8a', bottom: '#312e81' }, // Indigo
  { top: '#831843', bottom: '#4c1d95' }, // Magenta-Violet
  { top: '#065f46', bottom: '#064e3b' }, // Emerald
  { top: '#7c2d12', bottom: '#451a03' }, // Orange-Brown
  { top: '#155e75', bottom: '#083344' }, // Cyan
  { top: '#581c87', bottom: '#3b0764' }, // Purple
  { top: '#b91c1c', bottom: '#450a0a' }, // Red
  { top: '#1e293b', bottom: '#0f172a' }, // Slate
];

function getGradientForName(name: string): { top: string; bottom: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

/**
 * `<TVChannelTile />` is a Netflix-style portrait film card.
 * Channels are rendered as poster cards (portrait 2:3 aspect ratio) —
 * exactly like Netflix movie/show cards — with:
 *  - Cinematic gradient background per channel
 *  - Centered channel logo
 *  - Title overlaid at the bottom with gradient fade
 *  - Premium focus animation (scale + white border + glow)
 *  - "Now Playing" indicator for the active stream
 */
export const TVChannelTile: React.FC<TVChannelTileProps> = React.memo(({
  channel,
  onTileFocused,
}) => {
  const { playChannel, activeChannel } = useMediaEngine();
  const [isFocusedState, setIsFocusedState] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // Animated values for scale and focus border overlay opacity
  const focusAnimScale = useRef(new Animated.Value(1)).current;
  const focusAnimBorder = useRef(new Animated.Value(0)).current;

  const isActive = activeChannel?.id === channel.id;
  const gradient = getGradientForName(channel.name || 'TV');

  const handleFocus = () => {
    setIsFocusedState(true);
    if (onTileFocused) {
      onTileFocused(channel);
    }
    
    Animated.parallel([
      Animated.timing(focusAnimScale, {
        toValue: 1.12,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(focusAnimBorder, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleBlur = () => {
    setIsFocusedState(false);
    
    Animated.parallel([
      Animated.timing(focusAnimScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(focusAnimBorder, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePress = () => {
    playChannel(channel);
  };

  // Generate initials for the fallback poster
  const initials = channel.name
    ? channel.name.replace(/[^a-zA-Z0-9 ]/g, '').split(' ').map(w => w[0]).filter(c => c).join('').substring(0, 3).toUpperCase()
    : 'TV';

  return (
    <Pressable
      focusable={true}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onPress={handlePress}
      style={styles.pressableWrapper}
    >
      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ scale: focusAnimScale }],
          },
        ]}
      >
        {/* Cinematic Gradient Background (poster base) */}
        <View
          style={[
            styles.gradientBg,
            { backgroundColor: gradient.top } as ViewStyle,
          ]}
        >
          {/* Subtle radial overlay for depth */}
          <View style={[styles.gradientOverlay, { backgroundColor: gradient.bottom }]} />
        </View>

        {/* Channel Logo Image — centered like a movie poster */}
        {channel.logo && !logoError ? (
          <Image
            source={{ uri: channel.logo }}
            style={styles.posterLogo}
            resizeMode="contain"
            onError={() => setLogoError(true)}
          />
        ) : (
          <View style={styles.fallbackContainer}>
            <Text style={styles.fallbackText}>{initials}</Text>
          </View>
        )}

        {/* Top: "Now Playing" badge for active channel */}
        {isActive && (
          <View style={styles.playingBadge}>
            <View style={styles.playingDot} />
            <Text style={styles.playingText}>PLAYING</Text>
          </View>
        )}

        {/* Bottom gradient fade + title overlay (Netflix style) */}
        <View style={styles.bottomGradient} />
        <View style={styles.labelContainer}>
          <Text style={styles.channelName} numberOfLines={2}>
            {channel.name}
          </Text>
        </View>

        {/* Animated Focus Border Overlay (Netflix white glow) */}
        <Animated.View
          style={[
            styles.focusBorderOverlay,
            {
              opacity: focusAnimBorder,
            },
          ]}
        />

        {/* Focus glow shadow layer */}
        {isFocusedState && <View style={styles.focusGlow} />}
      </Animated.View>
    </Pressable>
  );
});

TVChannelTile.displayName = 'TVChannelTile';

const CARD_WIDTH = 145;
const CARD_HEIGHT = 210; // ~2:3 portrait poster ratio (Netflix film card)

const styles = StyleSheet.create({
  pressableWrapper: {
    // Extra margin for scale animation headroom on TV
    marginHorizontal: 6,
    marginVertical: 14,
    borderRadius: 6,
    overflow: Platform.OS === 'android' ? 'visible' : 'visible',
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    overflow: 'hidden',
    // Premium cinematic shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  gradientBg: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.85,
  },
  posterLogo: {
    position: 'absolute',
    top: 18,
    left: 12,
    right: 12,
    bottom: 55,
    opacity: 0.95,
  },
  fallbackContainer: {
    position: 'absolute',
    top: 18,
    left: 12,
    right: 12,
    bottom: 55,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  playingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229, 9, 20, 0.92)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
    zIndex: 5,
  },
  playingDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
    marginRight: 4,
  },
  playingText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: 'transparent',
  },
  labelContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  channelName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 15,
  },
  focusBorderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: 6,
    pointerEvents: 'none',
    zIndex: 10,
  },
  focusGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 6,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
    pointerEvents: 'none',
    zIndex: 9,
  },
});
