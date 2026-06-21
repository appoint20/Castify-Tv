import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  Pressable,
  Animated,
  Platform,
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
 * `<TVChannelTile />` is a highly-optimized D-pad navigatable tile component.
 * It uses native Pressable and high-performance Animated transitions for focus animations.
 */
export const TVChannelTile: React.FC<TVChannelTileProps> = React.memo(({
  channel,
  onTileFocused,
}) => {
  const { playChannel, activeChannel } = useMediaEngine();
  const [isFocusedState, setIsFocusedState] = useState(false);

  // Animated values for scale and active border overlay opacity
  const focusAnimScale = useRef(new Animated.Value(1)).current;
  const focusAnimBorder = useRef(new Animated.Value(0)).current;

  const isActive = activeChannel?.id === channel.id;

  const handleFocus = () => {
    setIsFocusedState(true);
    if (onTileFocused) {
      onTileFocused(channel);
    }
    
    // Animate scale up and fade in the focus border overlay
    Animated.parallel([
      Animated.timing(focusAnimScale, {
        toValue: 1.08,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(focusAnimBorder, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleBlur = () => {
    setIsFocusedState(false);
    
    // Animate scale back down and fade out the focus border overlay
    Animated.parallel([
      Animated.timing(focusAnimScale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(focusAnimBorder, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePress = () => {
    playChannel(channel);
  };

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
          styles.container,
          {
            transform: [{ scale: focusAnimScale }],
          },
        ]}
      >
        {/* Channel Logo Image */}
        {channel.logo ? (
          <Image
            source={{ uri: channel.logo }}
            style={styles.logoImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.fallbackLogoContainer}>
            <Text style={styles.fallbackLogoText} numberOfLines={2}>
              {channel.name.substring(0, 3).toUpperCase()}
            </Text>
          </View>
        )}

        {/* Dynamic bottom label drawer */}
        <View style={styles.labelContainer}>
          <Text style={styles.channelName} numberOfLines={1}>
            {channel.name}
          </Text>
        </View>

        {/* High performance active channel indicator bar */}
        {isActive && <View style={styles.playingIndicatorBar} />}

        {/* Animated Border Overlay (using opacity to preserve GPU useNativeDriver: true) */}
        <Animated.View
          style={[
            styles.focusBorderOverlay,
            {
              opacity: focusAnimBorder,
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
});

TVChannelTile.displayName = 'TVChannelTile';

const styles = StyleSheet.create({
  pressableWrapper: {
    // Crucial for Android TV focus rendering: prevents parent clippings
    margin: 10,
    borderRadius: 8,
    // Add extra padding or overflow visible for scale animation headroom
    overflow: Platform.OS === 'android' ? 'visible' : 'hidden',
  },
  container: {
    width: 160,
    height: 90,
    backgroundColor: '#262626',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    // Premium soft drop shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  logoImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.85,
  },
  fallbackLogoContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1E3A8A', // Deep blue premium base
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  fallbackLogoText: {
    color: '#F3F4F6',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  labelContainer: {
    height: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  channelName: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'left',
  },
  playingIndicatorBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#E50914', // Netflix Red accent
  },
  focusBorderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: '#E50914', // Netflix Red focus indicator
    borderRadius: 8,
    pointerEvents: 'none',
  },
});
