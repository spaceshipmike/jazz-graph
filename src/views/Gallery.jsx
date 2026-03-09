import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useData } from "../App";
import { instrumentColor, instrumentFamily, labelColor } from "../data";
import FilterBar from "../components/FilterBar";

export default function Gallery() {
  const { albums } = useData();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("q") || "";
  const instFilter = searchParams.get("inst") || null;
  const familyFilter = searchParams.get("family") || null;
  const labelFilter = searchParams.get("label") || null;
  const artistFilter = searchParams.get("artist") || null;

  const setSearch = useCallback((v) => {
    setSearchParams((p) => { v ? p.set("q", v) : p.delete("q"); return p; }, { replace: true });
  }, [setSearchParams]);
  const setInstFilter = useCallback((v) => {
    setSearchParams((p) => { v ? p.set("inst", v) : p.delete("inst"); return p; }, { replace: true });
  }, [setSearchParams]);
  const setFamilyFilter = useCallback((v) => {
    setSearchParams((p) => { v ? p.set("family", v) : p.delete("family"); return p; }, { replace: true });
  }, [setSearchParams]);
  const setLabelFilter = useCallback((v) => {
    setSearchParams((p) => { v ? p.set("label", v) : p.delete("label"); return p; }, { replace: true });
  }, [setSearchParams]);
  const setArtistFilter = useCallback((v) => {
    setSearchParams((p) => { v ? p.set("artist", v) : p.delete("artist"); return p; }, { replace: true });
  }, [setSearchParams]);

  const filtered = useMemo(() => {
    let r = albums;
    if (search) {
      const s = search.toLowerCase();
      r = r.filter(
        (a) =>
          a.title.toLowerCase().includes(s) ||
          a.artist.toLowerCase().includes(s) ||
          (a.label || "").toLowerCase().includes(s) ||
          a.lineup.some(
            (m) =>
              m.name.toLowerCase().includes(s) ||
              m.instrument.toLowerCase().includes(s),
          ),
      );
    }
    if (instFilter) {
      r = r.filter((a) => a.lineup.some((m) => m.instrument === instFilter));
    }
    if (familyFilter) {
      r = r.filter((a) => a.lineup.some((m) => instrumentFamily(m.instrument) === familyFilter));
    }
    if (labelFilter) {
      r = r.filter((a) => a.label === labelFilter);
    }
    if (artistFilter) {
      r = r.filter((a) => a.lineup.some((m) => m.name === artistFilter));
    }
    return r;
  }, [albums, search, instFilter, familyFilter, labelFilter, artistFilter]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const a of filtered) {
      const key = a.label || "Unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  return (
    <div style={{ padding: "0 var(--space-xl) var(--space-3xl)" }}>
      {/* Filter bar */}
      <FilterBar
        family={familyFilter}
        setFamily={setFamilyFilter}
        label={labelFilter}
        setLabel={setLabelFilter}
        artist={artistFilter}
        setArtist={setArtistFilter}
      />

      {/* Search + active instrument filter */}
      <div style={{ padding: "0 0 14px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search albums, artists, instruments..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mono"
          style={{
            padding: "8px 16px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            color: "var(--fg)",
            fontSize: 12,
            outline: "none",
            width: 300,
          }}
        />
        {instFilter && (
          <button
            onClick={() => setInstFilter(null)}
            className="pill"
            style={{
              background: instrumentColor(instFilter) + "22",
              border: `1px solid ${instrumentColor(instFilter)}`,
              color: instrumentColor(instFilter),
            }}
          >
            {instFilter} <span style={{ opacity: 0.5 }}>×</span>
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1, margin: "4px 0" }}>
          {filtered.length}{" "}
          <span style={{ fontWeight: 400, color: "var(--fg-dim)" }}>
            album{filtered.length !== 1 ? "s" : ""}
          </span>
        </h1>
      </div>

      {/* Groups */}
      {groups.map(([name, items]) => (
        <section key={name} style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14, borderBottom: `1px solid ${labelColor(name)}33`, paddingBottom: 8 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: labelColor(name) }}>{name}</h2>
            <span className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)" }}>
              {items.length} album{items.length > 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "var(--space-md)" }}>
            {items.map((album, i) => (
              <LazyCard key={album.id}>
                <AlbumCard album={album} index={i} instFilter={instFilter} setInstFilter={setInstFilter} />
              </LazyCard>
            ))}
          </div>
        </section>
      ))}

      {filtered.length === 0 && (
        <p className="mono" style={{ color: "var(--fg-muted)", fontSize: 13, textAlign: "center", padding: "60px 0" }}>
          No albums match your filters.
        </p>
      )}
    </div>
  );
}

function AlbumCard({ album, index, instFilter, setInstFilter }) {
  const coverSrc = album.coverPath ? `/data/${album.coverPath}` : null;

  return (
    <Link
      to={`/album/${album.id}`}
      className="card fade-in"
      style={{
        animationDelay: `${index * 40}ms`,
        display: "block",
        textDecoration: "none",
        overflow: "hidden",
      }}
    >
      {/* Cover */}
      <div style={{ aspectRatio: "1", background: "var(--surface)", overflow: "hidden", borderRadius: "var(--radius-lg) var(--radius-lg) 0 0" }}>
        {coverSrc ? (
          <img
            src={coverSrc}
            alt={album.title}
            loading="lazy"
            className="cover-img"
            onLoad={(e) => e.target.classList.add("loaded")}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="mono" style={{ color: "var(--fg-ghost)", fontSize: 10 }}>No cover</span>
          </div>
        )}
      </div>
      {/* Info */}
      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, marginBottom: 2 }}>
          {album.title}
        </div>
        <div className="mono" style={{ fontSize: 10, color: labelColor(album.label), marginBottom: 6 }}>
          {album.artist} · {album.year || "?"} · {album.label || "?"}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {album.lineup.slice(0, 5).map((m) => (
            <span
              key={m.name}
              className="pill"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setInstFilter(instFilter === m.instrument ? null : m.instrument);
              }}
              style={{
                background: "var(--surface-hover)",
                color: "var(--fg-muted)",
                borderLeft: `2px solid ${instrumentColor(m.instrument)}`,
                fontWeight: m.lead ? 700 : 400,
                fontSize: 9,
              }}
            >
              {m.lead ? "★ " : ""}
              {m.name.split(" ").pop()}
            </span>
          ))}
          {album.lineup.length > 5 && (
            <span className="mono" style={{ fontSize: 9, color: "var(--fg-ghost)", padding: "3px 4px" }}>
              +{album.lineup.length - 5}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function LazyCard({ children }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (!visible) return <div ref={ref} style={{ minHeight: 280 }} />;
  return children;
}
