import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  Pressable,
  Platform,
} from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import { Channel, PlayerState, PlayerStatus } from '../types/iptv';

interface VideoPlayerProps {
  /** The channel stream to load and decode */
  channel: Channel;
  /** Optional callback to notify parent of stream failures */
  onStreamError?: (channel: Channel, error: string) => void;
}

const PROXY_SERVER_URL = 'http://192.168.178.29:8081';
const PROXY_TOKEN = 'CASTIFY_SECURE_TOKEN_2026';

function shouldRouteThroughProxy(channel: Channel): boolean {
  if (!channel) return false;
  const groupLower = (channel.group || '').toLowerCase();
  const nameLower = (channel.name || '').toLowerCase();

  return groupLower.includes('india')
    || groupLower.includes('hindi')
    || nameLower.includes('india')
    || nameLower.includes('hindi')
    || groupLower.includes('hin')
    || nameLower.includes('hin ');
}

/**
 * `<VideoPlayer />` is a robust media playback container.
 * It integrates react-native-video (ExoPlayer) with granular state tracking,
 * fallback screens for offline links, and strict hardware decoder teardown.
 */
export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  channel,
  onStreamError,
}) => {
  const [playerState, setPlayerState] = useState<PlayerState>({
    status: 'idle',
    currentTime: 0,
    duration: 0,
    isPaused: false,
  });
  
  const [retryKey, setRetryKey] = useState(0);
  const videoRef = useRef<VideoRef>(null);
  
  // Track button focus for the Error fallback UI D-pad navigation
  const [retryButtonFocused, setRetryButtonFocused] = useState(false);

  const useProxy = shouldRouteThroughProxy(channel);
  const finalUri = useProxy
    ? `${PROXY_SERVER_URL}/api/stream?url=${encodeURIComponent(channel.url)}&token=${PROXY_TOKEN}`
    : channel.url;

  // Monitor stream mount & teardown lifecycle
  useEffect(() => {
    console.log(`[VideoPlayer] Mounted stream for channel: "${channel.name}" (Proxied: ${useProxy})`);
    
    // Set initial loading state
    setPlayerState({
      status: 'loading',
      currentTime: 0,
      duration: 0,
      isPaused: false,
    });

    // Auto-timeout: if stream hasn't loaded in 10s, show error instead of hanging
    const timeout = setTimeout(() => {
      setPlayerState((prev) => {
        if (prev.status === 'loading') {
          console.warn(`[VideoPlayer] Stream timeout after 10s for: "${channel.name}"`);
          return { ...prev, status: 'error', errorMessage: 'Connection timed out (10s)' };
        }
        return prev;
      });
    }, 10000);

    return () => {
      clearTimeout(timeout);
      console.log(`[VideoPlayer] Unmounting stream and releasing decoder for: "${channel.name}"`);
    };
  }, [channel, retryKey]);

  const handleLoadStart = () => {
    setPlayerState((prev) => ({ ...prev, status: 'loading' }));
  };

  const handleLoad = (data: any) => {
    console.log(`[VideoPlayer] Native stream loaded successfully. Resolution: ${data.naturalSize?.width}x${data.naturalSize?.height}`);
    setPlayerState((prev) => ({
      ...prev,
      status: 'ready',
      duration: data.duration || 0,
    }));
  };

  const handleBuffer = ({ isBuffering }: { isBuffering: boolean }) => {
    setPlayerState((prev) => ({
      ...prev,
      status: isBuffering ? 'buffering' : 'ready',
    }));
  };

  const handleProgress = (data: { currentTime: number; playableDuration: number }) => {
    setPlayerState((prev) => ({
      ...prev,
      currentTime: data.currentTime,
    }));
  };

  const handleError = (error: any) => {
    const errorString = error?.error?.extra?.toString() || error?.error?.what?.toString() || 'Unknown ExoPlayer Error';
    console.warn(`[VideoPlayer] Playback error on channel "${channel.name}":`, errorString);
    
    setPlayerState((prev) => ({
      ...prev,
      status: 'error',
      errorMessage: errorString,
    }));

    if (onStreamError) {
      onStreamError(channel, errorString);
    }
  };

  const handleRetry = () => {
    console.log(`[VideoPlayer] Retrying stream connectivity for channel: "${channel.name}"`);
    setRetryKey((prev) => prev + 1);
  };

  return (
    <View style={styles.container}>
      {/* ExoPlayer instance */}
      {playerState.status !== 'idle' && (
        <Video
          ref={videoRef}
          source={{
            uri: finalUri,
            headers: {
              'User-Agent': 'CastifyTV/1.0 (Android TV; ExoPlayer)',
            },
            bufferConfig: {
              minBufferMs: 5000, // 5s minimum buffer required before playing
              maxBufferMs: 15000, // Max buffer caching up to 15s of video
              bufferForPlaybackMs: 1000, // 1s initial buffer to start playback
              bufferForPlaybackAfterRebufferMs: 2000, // 2s buffer required after a connection drop before resuming
            },
          }}
          key={`${channel.id}_v_${retryKey}`}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          paused={playerState.isPaused}
          onLoadStart={handleLoadStart}
          onLoad={handleLoad}
          onBuffer={handleBuffer}
          onProgress={handleProgress}
          onError={handleError}
        />
      )}



      {/* Loading Overlay */}
      {playerState.status === 'loading' && (
        <View style={[StyleSheet.absoluteFill, styles.overlayContainer]}>
          <ActivityIndicator size="large" color="#bdd5ea" />
          <Text style={styles.overlayText}>Connecting to Stream...</Text>
        </View>
      )}

      {/* Buffering Overlay */}
      {playerState.status === 'buffering' && (
        <View style={[StyleSheet.absoluteFill, styles.overlayContainer, styles.transparentBg]}>
          <ActivityIndicator size="large" color="#bdd5ea" />
          <Text style={styles.overlayText}>Buffering...</Text>
        </View>
      )}

      {/* Error Fallback Overlay */}
      {playerState.status === 'error' && (
        <View style={[StyleSheet.absoluteFill, styles.overlayContainer, styles.errorOverlay]}>
          <Text style={styles.errorHeader}>Playback Failed</Text>
          <Text style={styles.errorMessageText}>
            {channel.name} is currently offline or unreachable.
          </Text>
          <Text style={styles.errorSubtext}>
            Code: {playerState.errorMessage || 'ExoPlayer DataSourceException'}
          </Text>

          {/* D-Pad Focusable Retry Button */}
          <Pressable
            focusable={true}
            onFocus={() => setRetryButtonFocused(true)}
            onBlur={() => setRetryButtonFocused(false)}
            onPress={handleRetry}
            style={[
              styles.retryButton,
              retryButtonFocused && styles.retryButtonFocused,
            ]}
          >
            <Text style={styles.retryButtonText}>Retry Stream Connection</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  overlayContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    zIndex: 10,
  },
  transparentBg: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  errorOverlay: {
    backgroundColor: '#1e2a35',
    padding: 24,
  },
  overlayText: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    letterSpacing: 0.5,
  },
  errorHeader: {
    color: '#bdd5ea',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    letterSpacing: 1,
  },
  errorMessageText: {
    color: '#F3F4F6',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    color: '#9CA3AF',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#262626',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#404040',
  },
  retryButtonFocused: {
    borderColor: '#bdd5ea',
    backgroundColor: '#bdd5ea',
    transform: [{ scale: 1.05 }],
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  secureRouteBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: '#1DB954',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    zIndex: 100,
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 5,
  },
  secureRouteText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
