import React from "react";
import axios from "axios";
import Header from "./components/Header";
import Hero from "./components/Hero";
import ChannelRail from "./components/ChannelRail";
import RailSkeleton from "./components/RailSkeleton";
import VideoPlayerModal from "./components/VideoPlayerModal";
import useFavorites from "./hooks/useFavorites";
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

  const { favorites, isFavorite, toggleFavorite } = useFavorites();

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

  // Build the visible rails (filtered by nav-tab + search + favorites),
  // and a flat playlist that maps directly to what the player can step through.
  const { visibleRails, flatPlaylist } = React.useMemo(() => {
    if (!data?.categories) return { visibleRails: [], flatPlaylist: [] };

    const searchLc = search.trim().toLowerCase();
    // 1. Flatten all channels
    const allChannels = data.categories.flatMap((c) => c.channels);
    const favChannels = allChannels.filter((c) => favorites.has(c.id));

    // 2. Apply nav-tab + search filter to backend categories
    const rails = data.categories
      .filter((cat) => activeCategory === "Home" || cat.category === activeCategory)
      .map((cat) => ({
        title: cat.category,
        channels: cat.channels.filter((c) =>
          searchLc ? c.name.toLowerCase().includes(searchLc) : true,
        ),
      }))
      .filter((cat) => cat.channels.length > 0);

    // 3. Inject the "My Favorites" rail at the top when on Home and there are favorites
    if (activeCategory === "Home" && favChannels.length > 0) {
      const filteredFavs = favChannels.filter((c) =>
        searchLc ? c.name.toLowerCase().includes(searchLc) : true,
      );
      if (filteredFavs.length > 0) {
        rails.unshift({ title: "★ My Favorites", channels: filteredFavs, favorites: true });
      }
    }

    return {
      visibleRails: rails,
      flatPlaylist: (() => {
        // Dedupe by id — a channel appearing in "My Favorites" AND its own category rail
        // should only count once so ← / → truly advance to a new stream.
        const seen = new Set();
        const flat = [];
        for (const r of rails) {
          for (const c of r.channels) {
            if (!seen.has(c.id)) {
              seen.add(c.id);
              flat.push(c);
            }
          }
        }
        return flat;
      })(),
    };
  }, [data, activeCategory, search, favorites]);

  const isFirstLoad = !data;
  const isProbing = status && (status.state === "fetching" || status.state === "probing");
  const showEmpty = !isFirstLoad && !isProbing && visibleRails.length === 0;

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
          <div data-testid="empty-state" className="px-6 md:px-16 py-16 text-center max-w-xl mx-auto">
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
          visibleRails.map((rail) => (
            <div key={rail.title} id={`rail-anchor-${rail.title}`}>
              <ChannelRail
                title={rail.title}
                channels={rail.channels}
                onPlay={(c) => setPlaying(c)}
                isFavorite={isFavorite}
                onToggleFavorite={toggleFavorite}
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

      {playing && (
        <VideoPlayerModal
          channel={playing}
          playlist={flatPlaylist.length ? flatPlaylist : [playing]}
          onChangeChannel={(c) => setPlaying(c)}
          onClose={() => setPlaying(null)}
          isFavorite={isFavorite(playing.id)}
          onToggleFavorite={toggleFavorite}
        />
      )}

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
