import React from "react";
import { Search, X } from "lucide-react";

export default function Header({
  scrolled,
  activeCategory,
  categories,
  onCategoryClick,
  germanEnabled,
  onGermanToggle,
  search,
  onSearchChange,
}) {
  const [searchOpen, setSearchOpen] = React.useState(false);

  return (
    <header
      data-testid="app-header"
      className={`fixed top-0 left-0 right-0 z-40 transition-colors duration-300 ${
        scrolled ? "bg-nflix-bg/95 backdrop-blur-sm border-b border-white/5" : "bg-gradient-to-b from-black/70 to-transparent"
      }`}
    >
      <div className="flex items-center justify-between px-6 md:px-12 py-4">
        <div className="flex items-center gap-8">
          <a
            href="#top"
            data-testid="brand-logo"
            className="font-heading font-black text-nflix-red text-2xl md:text-3xl tracking-tight select-none"
          >
            CAST<span className="text-white">IFY</span>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {categories.map((cat) => (
              <button
                key={cat}
                data-testid={`nav-${cat.toLowerCase()}`}
                onClick={() => onCategoryClick(cat)}
                className={`transition-colors duration-200 hover:text-white ${
                  activeCategory === cat ? "text-white font-semibold" : "text-nflix-gray"
                }`}
              >
                {cat}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          {/* Search */}
          <div className="flex items-center">
            {searchOpen ? (
              <div className="flex items-center bg-black/80 border border-white/20 rounded-sm">
                <Search className="w-4 h-4 mx-2 text-nflix-gray" />
                <input
                  data-testid="search-input"
                  autoFocus
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Channels, categories…"
                  className="bg-transparent text-sm py-1.5 pr-2 w-40 md:w-56 focus:outline-none placeholder:text-nflix-muted"
                />
                <button
                  data-testid="search-close-btn"
                  onClick={() => {
                    setSearchOpen(false);
                    onSearchChange("");
                  }}
                  className="p-1.5 text-nflix-gray hover:text-white"
                  aria-label="Close search"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                data-testid="search-open-btn"
                onClick={() => setSearchOpen(true)}
                className="text-nflix-gray hover:text-white transition"
                aria-label="Open search"
              >
                <Search className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* German toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none" data-testid="german-toggle-label">
            <span className="text-xs uppercase tracking-[0.18em] font-semibold text-nflix-gray hidden sm:inline">
              German
            </span>
            <button
              data-testid="german-toggle"
              role="switch"
              aria-checked={germanEnabled}
              onClick={() => onGermanToggle(!germanEnabled)}
              className={`toggle-track relative w-11 h-6 rounded-full ${
                germanEnabled ? "bg-nflix-red" : "bg-white/20"
              }`}
            >
              <span
                className="toggle-thumb absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow"
                style={{ transform: germanEnabled ? "translateX(20px)" : "translateX(0)" }}
              />
            </button>
          </label>
        </div>
      </div>
    </header>
  );
}
