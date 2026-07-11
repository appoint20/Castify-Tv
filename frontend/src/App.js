import React from "react";
import axios from "axios";
import Header from "./components/Header";
import Hero from "./components/Hero";
import ChannelRail from "./components/ChannelRail";
import RailSkeleton from "./components/RailSkeleton";
import VideoPlayerModal from "./components/VideoPlayerModal";
import { Loader2, RefreshCw } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const NAV_CATEGORIES = ["Home", "Movies", "Sports", "Hindi", "Music", "German"];

export default function App() {
  const [scrolled, setScrolled] = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState("Home");
  const [germanEnabled, setGermanEnabled] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [data, setData] = React.useState(null);
  const [hero, setHero] = React.useState(null);
  const [status, setStatus] = React.useState(null);
  const [error, setError] = React.useState("");
  const [playing, setPlaying] = React.useState(null);

  // Fetch channels whenever the toggle changes
  const fetchChannels = React.useCallback(async () => {
    try {
      setError("");
      const res = await axios.get(`${API}/channels`, {
        params: { include_german: germanEnabled },
      });
      setData(res.data);
    } catch (e) {
      setError("Could not reach the Castify backend.");
    }
  }, [germanEnabled]);

  const fetchHero = React.useCallback(async () => {
    try {
      const res = await axios.get(`${API}/hero`);
      setHero(res.data?.channel || null);
    } catch (e) {
      /* silent */
    }
  }, []);

  const fetchStatus = React.useCallback(async () => {
    try {
      const res = await axios.get(`${API}/status`);
      setStatus(res.data);
      return res.data;
    } catch (e) {
      return null;
    }
  }, []);

  // Initial load + polling while probing
  React.useEffect(() => {
    let interval;
    (async () => {
      const s = await fetchStatus();
      await fetchChannels();
      await fetchHero();
      if (s && (s.state === "fetching" || s.state === "probing")) {
        interval = setInterval(async () => {
          const cur = await fetchStatus();
          if (cur && cur.state === "done") {
            clearInterval(interval);
            await fetchChannels();
            await fetchHero();
          } else if (cur) {
            // Update channels list mid-flight so user sees progress
            await fetchChannels();
          }
        }, 4000);
      }
    })();
    return () => interval && clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    fetchChannels();
  }, [germanEnabled, fetchChannels]);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onCategoryClick = (cat) => {
    setActiveCategory(cat);
    if (cat === "Home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const el = document.getElementById(`rail-anchor-${cat}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const triggerRefresh = async () => {
    try {
      await axios.post(`${API}/refresh`);
      await fetchStatus();
    } catch (e) {
      /* ignore */
    }
  };

  // Filter the rendered data by search + category tab
  const visibleCategories = React.useMemo(() => {
    if (!data?.categories) return [];
    const searchLc = search.trim().toLowerCase();
    return data.categories
      .filter((cat) => activeCategory === "Home" || cat.category === activeCategory)
      .map((cat) => ({
        ...cat,
        channels: cat.channels.filter((c) =>
          searchLc ? c.name.toLowerCase().includes(searchLc) : true,
        ),
      }))
      .filter((cat) => cat.channels.length > 0);
  }, [data, activeCategory, search]);

  const isFirstLoad = !data;
  const isProbing = status && (status.state === "fetching" || status.state === "probing");
  const showEmpty = !isFirstLoad && !isProbing && visibleCategories.length === 0;

  return (
    <div className="min-h-screen bg-nflix-bg text-white">
      <Header
        scrolled={scrolled}
        activeCategory={activeCategory}
        categories={NAV_CATEGORIES}
        onCategoryClick={onCategoryClick}
        germanEnabled={germanEnabled}
        onGermanToggle={setGermanEnabled}
        search={search}
        onSearchChange={setSearch}
      />

      <Hero
        channel={hero}
        onPlay={(c) => setPlaying(c)}
        onInfo={() => window.scrollTo({ top: window.innerHeight * 0.7, behavior: "smooth" })}
      />

      {/* Probing banner */}
      {isProbing && (
        <div
          data-testid="probing-banner"
          className="mx-6 md:mx-16 -mt-10 relative z-20 mb-6 flex items-center gap-3 bg-black/80 border border-nflix-red/40 rounded-md px-4 py-3 backdrop-blur-sm animate-fadeIn"
        >
          <Loader2 className="w-4 h-4 animate-spin text-nflix-red" />
          <span className="text-sm text-white/90">
            {status?.state === "fetching"
              ? "Downloading playlists…"
              : `Verifying streams — ${status?.checked || 0}/${status?.total || "…"} checked, ${
                  status?.working || 0
                } confirmed live`}
          </span>
        </div>
      )}

      <main className="pb-24 -mt-4 md:-mt-8 relative z-10">
        {isFirstLoad ? (
          <>
            <RailSkeleton />
            <RailSkeleton />
            <RailSkeleton />
          </>
        ) : showEmpty ? (
          <div
            data-testid="empty-state"
            className="px-6 md:px-16 py-16 text-center max-w-xl mx-auto"
          >
            <h3 className="font-heading text-2xl font-bold mb-2">No channels found</h3>
            <p className="text-nflix-gray mb-6">
              {search
                ? `We couldn't find any channels matching "${search}".`
                : "No channels are currently available in this category."}
            </p>
            <button
              data-testid="refresh-btn"
              onClick={triggerRefresh}
              className="inline-flex items-center gap-2 bg-nflix-red hover:bg-nflix-redHover px-5 py-2.5 rounded-sm font-semibold transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh channels
            </button>
          </div>
        ) : (
          visibleCategories.map((cat) => (
            <div key={cat.category} id={`rail-anchor-${cat.category}`}>
              <ChannelRail
                title={cat.category}
                channels={cat.channels}
                onPlay={(c) => setPlaying(c)}
              />
            </div>
          ))
        )}
      </main>

      {error && (
        <div
          data-testid="error-banner"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-nflix-red text-white text-sm px-4 py-2 rounded shadow-lg"
        >
          {error}
        </div>
      )}

      {playing && <VideoPlayerModal channel={playing} onClose={() => setPlaying(null)} />}

      <footer className="border-t border-white/5 py-8 px-6 md:px-16 text-xs text-nflix-muted">
        IPTV org streams • Powered by{" "}
        <a
          href="https://github.com/iptv-org/iptv"
          target="_blank"
          rel="noreferrer"
          className="text-nflix-gray hover:text-white"
        >
          iptv-org
        </a>
        {" "}• Castify auto-filters non-working and geo-blocked streams.
      </footer>
    </div>
  );
}
