import React from "react";
import { Play, Info } from "lucide-react";

const HERO_IMAGE =
  "https://images.pexels.com/photos/3379932/pexels-photo-3379932.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export default function Hero({ channel, onPlay, onInfo }) {
  const title = channel?.name || "Live Indian TV — Cinematic. Uninterrupted.";
  const category = channel?.category || "Live Stream";
  const description = channel
    ? `Stream ${channel.name} live from ${channel.category}. Curated, geo-verified and free to watch — instantly.`
    : "Hindi movies, cricket, chart-topping music, non-stop. All in one place — Netflix-clean, DVR-fast.";

  return (
    <section
      data-testid="hero-section"
      className="relative w-full h-[78vh] min-h-[520px] overflow-hidden"
      id="top"
    >
      <img
        src={HERO_IMAGE}
        alt="Featured backdrop"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#141414]/95 via-[#141414]/50 to-transparent" />

      <div className="relative z-10 flex flex-col justify-end h-full px-6 md:px-16 pb-20 md:pb-28 max-w-3xl">
        <span
          data-testid="hero-badge"
          className="inline-block w-fit uppercase tracking-[0.28em] text-[0.7rem] font-bold text-nflix-red mb-4"
        >
          {category} • Live
        </span>
        <h1
          data-testid="hero-title"
          className="font-heading font-black text-4xl sm:text-5xl lg:text-6xl leading-[1.05] mb-4 drop-shadow-2xl"
        >
          {title}
        </h1>
        <p
          data-testid="hero-description"
          className="text-nflix-gray text-base md:text-lg max-w-xl mb-6 leading-relaxed"
        >
          {description}
        </p>
        <div className="flex items-center gap-3">
          <button
            data-testid="hero-play-btn"
            onClick={() => channel && onPlay(channel)}
            disabled={!channel}
            className="flex items-center gap-2 bg-white text-black font-bold px-6 py-2.5 rounded-sm hover:bg-white/85 transition-colors duration-200 disabled:opacity-50"
          >
            <Play className="w-5 h-5 fill-black" />
            Watch Now
          </button>
          <button
            data-testid="hero-info-btn"
            onClick={onInfo}
            className="flex items-center gap-2 bg-white/20 text-white font-semibold px-6 py-2.5 rounded-sm hover:bg-white/30 transition-colors duration-200"
          >
            <Info className="w-5 h-5" />
            More Info
          </button>
        </div>
      </div>
    </section>
  );
}
