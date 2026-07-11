import React from "react";
import Hls from "hls.js";
import { X, Volume2, VolumeX, Loader2, AlertTriangle } from "lucide-react";

export default function VideoPlayerModal({ channel, onClose }) {
  const videoRef = React.useRef(null);
  const hlsRef = React.useRef(null);
  const [state, setState] = React.useState("loading"); // loading | playing | error
  const [muted, setMuted] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");

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

  // Close on ESC
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!channel) return null;

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

        {/* Overlay states */}
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
          </div>
        )}

        {/* Top bar */}
        <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/85 to-transparent">
          <div>
            <div className="text-[0.65rem] uppercase tracking-[0.22em] text-nflix-red font-bold">
              {channel.category} • Live
            </div>
            <div className="font-heading font-bold text-lg md:text-xl">{channel.name}</div>
          </div>
          <div className="flex items-center gap-2">
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
      </div>
    </div>
  );
}
