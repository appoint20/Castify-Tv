import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ChannelCard from "./ChannelCard";

export default function ChannelRail({ title, channels, onPlay }) {
  const scrollerRef = React.useRef(null);

  const scroll = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  if (!channels || channels.length === 0) return null;

  return (
    <section data-testid={`rail-${title.toLowerCase()}`} className="mb-10 md:mb-12 animate-fadeUp">
      <div className="flex items-baseline justify-between px-6 md:px-16 mb-3">
        <h2 className="font-heading text-xl md:text-2xl font-bold tracking-tight">
          {title}
          <span className="ml-3 text-xs uppercase tracking-[0.2em] text-nflix-muted font-semibold">
            {channels.length} live
          </span>
        </h2>
      </div>

      <div className="relative group">
        <button
          data-testid={`rail-${title.toLowerCase()}-prev`}
          onClick={() => scroll(-1)}
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-14 bg-black/60 hover:bg-black/85 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div
          ref={scrollerRef}
          className="no-scrollbar flex gap-3 md:gap-4 overflow-x-auto scroll-smooth px-6 md:px-16 py-2"
        >
          {channels.map((c) => (
            <ChannelCard key={c.id} channel={c} onPlay={onPlay} />
          ))}
        </div>

        <button
          data-testid={`rail-${title.toLowerCase()}-next`}
          onClick={() => scroll(1)}
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-14 bg-black/60 hover:bg-black/85 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </section>
  );
}
