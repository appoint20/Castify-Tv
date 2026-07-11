import React from "react";
import { Play } from "lucide-react";

const GRADIENTS = [
  "linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%)",
  "linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%)",
  "linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)",
  "linear-gradient(135deg, #064e3b 0%, #059669 100%)",
  "linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)",
  "linear-gradient(135deg, #1e3a8a 0%, #4338ca 100%)",
  "linear-gradient(135deg, #831843 0%, #db2777 100%)",
  "linear-gradient(135deg, #1f2937 0%, #4b5563 100%)",
];

function pickGradient(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

function initials(name = "") {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "TV";
}

export default function ChannelCard({ channel, onPlay }) {
  const [logoOk, setLogoOk] = React.useState(!!channel.logo);
  return (
    <button
      data-testid={`channel-card-${channel.id}`}
      onClick={() => onPlay(channel)}
      className="channel-card group relative shrink-0 w-[220px] md:w-[240px] aspect-video rounded-md overflow-hidden bg-nflix-card text-left"
    >
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ background: pickGradient(channel.name) }}
      >
        {channel.logo && logoOk ? (
          <img
            src={channel.logo}
            alt={channel.name}
            className="max-h-16 max-w-[70%] object-contain drop-shadow-lg"
            onError={() => setLogoOk(false)}
          />
        ) : (
          <span className="font-heading font-black text-3xl text-white/90 tracking-widest drop-shadow">
            {initials(channel.name)}
          </span>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[0.65rem] uppercase tracking-[0.18em] text-nflix-red font-bold">
            {channel.category}
          </div>
          <div className="text-sm font-semibold text-white truncate">{channel.name}</div>
        </div>
        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white text-black w-8 h-8 rounded-full flex items-center justify-center shrink-0">
          <Play className="w-4 h-4 fill-black" />
        </span>
      </div>
    </button>
  );
}
