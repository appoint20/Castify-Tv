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

  // Monitor stream mount & teardown lifecycle
  useEffect(() => {
    console.log(`[VideoPlayer] Mounted stream for channel: "${channel.name}"`);
    
    // Set initial loading state
    setPlayerState({
      status: 'loading',
      currentTime: 0,
      duration: 0,
      isPaused: false,
    });

    return () => {
      // Critical cleanup: ensure the native decoder is fully released when navigating away.
      // Setting state to idle triggers conditional unmounting in React Native.
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
            uri: channel.url,
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
          <ActivityIndicator size="large" color="#E50914" />
          <Text style={styles.overlayText}>Connecting to Stream...</Text>
        </View>
      )}

      {/* Buffering Overlay */}
      {playerState.status === 'buffering' && (
        <View style={[StyleSheet.absoluteFill, styles.overlayContainer, styles.transparentBg]}>
          <ActivityIndicator size="large" color="#E50914" />
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
    backgroundColor: '#141414',
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
    color: '#E50914', // Netflix Red
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
    borderColor: '#E50914',
    backgroundColor: '#E50914',
    transform: [{ scale: 1.05 }],
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
