import React, { createContext, useContext, useState, useCallback } from 'react';
import { Channel, MediaEngineContextType } from '../types/iptv';

// Global typed event listener for tracking channel switches or external integrations
type ChannelChangeListener = (channel: Channel) => void;

class MediaEventEmitter {
  private listeners: Set<ChannelChangeListener> = new Set();

  /**
   * Subscribe to global channel switch events
   * @returns Unsubscribe function
   */
  public subscribe(listener: ChannelChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emit a channel change event
   */
  public emit(channel: Channel): void {
    this.listeners.forEach((listener) => {
      try {
        listener(channel);
      } catch (err) {
        console.error('[MediaEventEmitter] Listener error: ', err);
      }
    });
  }
}

// Singleton event emitter instance
export const globalMediaEvents = new MediaEventEmitter();

const MediaEngineContext = createContext<MediaEngineContextType | undefined>(undefined);

interface MediaEngineProviderProps {
  children: React.ReactNode;
}

/**
 * MediaEngineProvider coordinates active streams across the IPTV template.
 */
export const MediaEngineProvider: React.FC<MediaEngineProviderProps> = ({ children }) => {
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);

  const playChannel = useCallback((channel: Channel) => {
    console.log(`[MediaEngine] Initiating channel change: "${channel.name}" -> ${channel.url}`);
    setActiveChannel(channel);
    // Emit event to global observers (e.g. logging, analytics, or native bridging)
    globalMediaEvents.emit(channel);
  }, []);

  const stopPlayback = useCallback(() => {
    console.log('[MediaEngine] Halting playback and releasing resources');
    setActiveChannel(null);
  }, []);

  return (
    <MediaEngineContext.Provider
      value={{
        activeChannel,
        playChannel,
        stopPlayback,
      }}
    >
      {children}
    </MediaEngineContext.Provider>
  );
};

/**
 * Hook to consume active media engine controls
 */
export const useMediaEngine = (): MediaEngineContextType => {
  const context = useContext(MediaEngineContext);
  if (!context) {
    throw new Error('useMediaEngine must be used within a MediaEngineProvider');
  }
  return context;
};
