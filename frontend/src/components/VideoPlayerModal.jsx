import React from "react";
import Hls from "hls.js";
import {
  X, Volume2, VolumeX, Loader2, AlertTriangle,
  Star, SkipForward, SkipBack,
} from "lucide-react";

export default function VideoPlayerModal({
  channel,
  playlist = [],
  onClose,
  onChangeChannel,
  isFavorite,
  onToggleFavorite,
}) {
  const videoRef = React.useRef(null);
  const hlsRef = React.useRef(null);
  const [state, setState] = React.useState("loading"); // loading | playing | error
  const [muted, setMuted] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");

  const currentIndex = React.useMemo(
    () => playlist.findIndex((c) => c.id === channel?.id),
    [playlist, channel],
  );

  const goRelative = React.useCallback(
    (delta) => {
      if (!playlist.length || !onChangeChannel) return;
      const from = currentIndex === -1 ? 0 : currentIndex;
      const nextIdx = (from + delta + playlist.length) % playlist.length;
      onChangeChannel(playlist[nextIdx]);
    },
    [playlist, currentIndex, onChangeChannel],
  );

  // Set up HLS whenever the channel changes
  React.useEffect(() => {
    if (!channel) return;
    const video = videoRef.current;
    if (!video) return;

    setState("loading");
    setErrorMsg("");

    const cleanup = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        maxBufferLength: 30,
        capLevelToPlayerSize: true,
      });
      hlsRef.current = hls;
      hls.loadSource(channel.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) {
          setState("error");
          setErrorMsg(
            data.type === Hls.ErrorTypes.NETWORK_ERROR
              ? "Network error — stream may be geo-blocked or offline."
              : "Playback error — this stream isn't currently available.",
          );
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = channel.url;
      video.play().catch(() => {});
    } else {
      setState("error");
      setErrorMsg("Your browser doesn't support HLS streaming.");
    }

    const onPlaying = () => setState("playing");
    const onWaiting = () => setState("loading");
    const onVideoErr = () => {
      setState("error");
      setErrorMsg("The video element could not load this stream.");
    };
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("error", onVideoErr);

    return () => {
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("error", onVideoErr);
      cleanup();
    };
  }, [channel]);

  React.useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  // Keyboard + Remote-media key controls: ESC=close, ←/→ or MediaTrackPrev/Next=switch channel,
  // 'f' toggles favorite, 'm' toggles mute
  React.useEffect(() => {
    const onKey = (e) => {
      // Never override typing inside form fields
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight" || e.key === "MediaTrackNext") {
        goRelative(1);
        e.preventDefault();
      } else if (e.key === "ArrowLeft" || e.key === "MediaTrackPrevious") {
        goRelative(-1);
        e.preventDefault();
      } else if (e.key === "f" || e.key === "F") {
        if (channel && onToggleFavorite) onToggleFavorite(channel.id);
      } else if (e.key === "m" || e.key === "M") {
        setMuted((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goRelative, channel, onToggleFavorite]);

  // Web Media Session API — enables physical media keys / bluetooth remote / TV remote next-track buttons
  React.useEffect(() => {
    if (!("mediaSession" in navigator) || !channel) return;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: channel.name,
        artist: channel.category,
        album: "Castify Live TV",
        artwork: channel.logo
          ? [{ src: channel.logo, sizes: "256x256", type: "image/png" }]
          : [],
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => goRelative(1));
      navigator.mediaSession.setActionHandler("previoustrack", () => goRelative(-1));
    } catch {
      /* not supported — ignore */
    }
    return () => {
      try {
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
      } catch {
        /* ignore */
      }
    };
  }, [channel, goRelative]);

  if (!channel) return null;
  const canStep = playlist.length > 1;

  return (
    <div
      data-testid="player-modal"
      className="fixed inset-0 z-50 player-backdrop flex items-center justify-center animate-fadeIn p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl aspect-video bg-black rounded-lg overflow-hidden shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        <video
          data-testid="video-player"
          ref={videoRef}
          controls
          autoPlay
          playsInline
          className="w-full h-full object-contain bg-black"
        />

        {state === "loading" && (
          <div
            data-testid="player-loading"
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 pointer-events-none"
          >
            <Loader2 className="w-10 h-10 text-nflix-red animate-spin" />
            <p className="mt-3 text-nflix-gray text-sm">Connecting to {channel.name}…</p>
          </div>
        )}
        {state === "error" && (
          <div
            data-testid="player-error"
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 px-6 text-center"
          >
            <AlertTriangle className="w-10 h-10 text-nflix-red" />
            <h3 className="mt-3 font-heading text-xl font-bold">Stream unavailable</h3>
            <p className="mt-1 text-nflix-gray text-sm max-w-md">{errorMsg}</p>
            <p className="mt-3 text-xs text-nflix-muted">
              Tip: press <kbd className="px-1.5 py-0.5 bg-white/10 rounded">→</kbd> to try the next channel.
            </p>
          </div>
        )}

        {/* Top bar */}
        <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/85 to-transparent">
          <div className="min-w-0">
            <div className="text-[0.65rem] uppercase tracking-[0.22em] text-nflix-red font-bold">
              {channel.category} • Live
            </div>
            <div className="font-heading font-bold text-lg md:text-xl truncate">{channel.name}</div>
          </div>
          <div className="flex items-center gap-2">
            {onToggleFavorite && (
              <button
                data-testid="player-favorite-btn"
                onClick={() => onToggleFavorite(channel.id)}
                className={`p-2 rounded-full transition-colors ${
                  isFavorite ? "bg-nflix-red text-white" : "bg-white/10 hover:bg-white/25"
                }`}
                aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
              >
                <Star className={`w-5 h-5 ${isFavorite ? "fill-white" : ""}`} />
              </button>
            )}
            <button
              data-testid="player-mute-btn"
              onClick={() => setMuted((m) => !m)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/25 transition-colors"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <button
              data-testid="player-close-btn"
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/25 transition-colors"
              aria-label="Close player"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Prev / Next channel side buttons (visible if there is a playlist) */}
        {canStep && (
          <>
            <button
              data-testid="player-prev-btn"
              onClick={() => goRelative(-1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/55 hover:bg-black/85 flex items-center justify-center backdrop-blur-sm transition-colors"
              aria-label="Previous channel"
              title="Previous channel  (◄ / MediaPrev)"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              data-testid="player-next-btn"
              onClick={() => goRelative(1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/55 hover:bg-black/85 flex items-center justify-center backdrop-blur-sm transition-colors"
              aria-label="Next channel"
              title="Next channel  (► / MediaNext)"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Hint strip at the bottom */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-[0.7rem] text-nflix-gray flex items-center gap-3 pointer-events-none">
          <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">←</kbd> Prev</span>
          <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">→</kbd> Next</span>
          <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">F</kbd> Favorite</span>
          <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
