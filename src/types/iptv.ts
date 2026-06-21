/**
 * Represents a single IPTV channel parsed from an M3U playlist.
 */
export interface Channel {
  /** Unique identifier generated for the channel (e.g., hash or index) */
  id: string;
  /** The display name of the channel */
  name: string;
  /** The streaming source URL (typically an HLS .m3u8 or TS stream) */
  url: string;
  /** The group/category the channel belongs to (e.g., "News", "Sports") */
  group: string;
  /** The TV guide logo image URL if available */
  logo?: string;
  /** TV guide identifier code for EPG matching */
  tvgId?: string;
  /** TV guide display name */
  tvgName?: string;
}

/**
 * Represents a grouped collection of IPTV channels, e.g., for a category row.
 */
export interface ChannelGroup {
  /** The title of the category/group */
  title: string;
  /** Array of channels belonging to this category */
  channels: Channel[];
}

/**
 * Detailed status tracking for the ExoPlayer engine.
 */
export type PlayerStatus = 'idle' | 'loading' | 'buffering' | 'ready' | 'error';

/**
 * The state representation of the video playback status.
 */
export interface PlayerState {
  /** Current playback status */
  status: PlayerStatus;
  /** Human-readable error details if the stream fails to load or play */
  errorMessage?: string;
  /** Current playhead time in seconds */
  currentTime: number;
  /** Total duration of stream in seconds (0 for live streams) */
  duration: number;
  /** Whether the stream is currently paused */
  isPaused: boolean;
}

/**
 * Context type defining the capabilities of the IPTV media engine coordinator.
 */
export interface MediaEngineContextType {
  /** The currently selected active channel */
  activeChannel: Channel | null;
  /** Method to change active channel and trigger playout */
  playChannel: (channel: Channel) => void;
  /** Method to pause or stop active playback and clear states */
  stopPlayback: () => void;
}
