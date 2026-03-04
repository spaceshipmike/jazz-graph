import { useState, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useData } from "../App";
import { instrumentColor, labelColor, slugify } from "../data";
import { searchReleases, fetchReleaseDetails } from "../musicbrainz";

export default function Gallery() {
  const { albums, onAddAlbum } = useData();
  const [addOpen, setAddOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("q") || "";
  const groupBy = searchParams.get("group") || "label";
  const instFilter = searchParams.get("inst") || null;

  const setSearch = useCallback((v) => {
    setSearchParams((p) => { v ? p.set("q", v) : p.delete("q"); return p; }, { replace: true });
  }, [setSearchParams]);
  const setGroupBy = useCallback((v) => {
    setSearchParams((p) => { p.set("group", v); return p; }, { replace: true });
  }, [setSearchParams]);
  const setInstFilter = useCallback((v) => {
    setSearchParams((p) => { v ? p.set("inst", v) : p.delete("inst"); return p; }, { replace: true });
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
    return r;
  }, [albums, search, instFilter]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const a of filtered) {
      let key;
      if (groupBy === "label") key = a.label || "Unknown";
      else if (groupBy === "decade") key = a.year ? Math.floor(a.year / 10) * 10 + "s" : "Unknown";
      else if (groupBy === "leader") key = a.artist;
      else {
        const lead = a.lineup.find((m) => m.lead);
        key = lead?.instrument || "unknown";
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    }
    let sorted = [...map.entries()];
    if (groupBy === "decade") sorted.sort((a, b) => a[0].localeCompare(b[0]));
    else sorted.sort((a, b) => b[1].length - a[1].length);
    return sorted;
  }, [filtered, groupBy]);

  const groupColor = (name) => {
    if (groupBy === "label") return labelColor(name);
    if (groupBy === "lead instrument") return instrumentColor(name);
    return "var(--fg-dim)";
  };

  return (
    <div style={{ padding: "0 var(--space-xl) var(--space-3xl)" }}>
      {/* Filters */}
      <div style={{ padding: "14px 0", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
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
        <button
          onClick={() => setAddOpen(!addOpen)}
          className="mono"
          style={{
            padding: "7px 14px",
            border: "1px solid var(--fg-ghost)",
            borderRadius: "var(--radius-pill)",
            color: addOpen ? "var(--bg)" : "var(--fg-dim)",
            background: addOpen ? "var(--fg)" : "transparent",
            fontSize: 11,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            transition: "var(--ease-default)",
          }}
        >
          + Add Album
        </button>
        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          <span className="mono" style={{ fontSize: 10, color: "var(--fg-ghost)", marginRight: 4, lineHeight: "26px" }}>GROUP</span>
          {["label", "decade", "leader", "lead instrument"].map((g) => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className="mono"
              style={{
                padding: "3px 10px",
                border: "1px solid",
                borderRadius: "var(--radius-pill)",
                borderColor: groupBy === g ? "var(--fg-muted)" : "var(--border)",
                background: groupBy === g ? "var(--surface-hover)" : "transparent",
                color: groupBy === g ? "var(--fg)" : "var(--fg-muted)",
                fontSize: 10,
                textTransform: "uppercase",
              }}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Add Album Form */}
      {addOpen && (
        <AddAlbumForm
          onAdd={(album) => {
            onAddAlbum(album);
            setAddOpen(false);
          }}
          onClose={() => setAddOpen(false)}
        />
      )}

      {/* Stats */}
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1, margin: "4px 0" }}>
          {filtered.length}{" "}
          <span style={{ fontWeight: 400, fontStyle: "italic", color: "var(--fg-dim)" }}>
            album{filtered.length !== 1 ? "s" : ""}
          </span>
        </h1>
      </div>

      {/* Groups */}
      {groups.map(([name, items]) => (
        <section key={name} style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14, borderBottom: `1px solid ${groupColor(name)}33`, paddingBottom: 8 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: groupColor(name) }}>{name}</h2>
            <span className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)" }}>
              {items.length} album{items.length > 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "var(--space-md)" }}>
            {items.map((album, i) => (
              <AlbumCard key={album.id} album={album} index={i} instFilter={instFilter} setInstFilter={setInstFilter} />
            ))}
          </div>
        </section>
      ))}

      {filtered.length === 0 && (
        <p className="mono" style={{ color: "var(--fg-muted)", fontSize: 13, textAlign: "center", padding: "60px 0" }}>
          No albums match your search.
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
      <div style={{ aspectRatio: "1", background: "var(--surface)", overflow: "hidden", borderRadius: "var(--radius-lg) var(--radius-lg) 0 0", position: "relative" }}>
        {album.userAdded && (
          <span className="mono" style={{
            position: "absolute", top: 6, right: 6, zIndex: 2,
            background: "var(--bg)", border: "1px solid var(--fg-ghost)",
            borderRadius: "var(--radius-sm)", padding: "2px 5px",
            fontSize: 8, color: "var(--fg-muted)", letterSpacing: "0.05em",
          }}>
            ADDED
          </span>
        )}
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

function AddAlbumForm({ onAdd, onClose }) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [results, setResults] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    if (!title.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setPreview(null);
    try {
      const res = await searchReleases(title.trim(), artist.trim());
      if (res.length === 0) setError("No results found. Try different spelling.");
      else setResults(res);
    } catch (e) {
      setError("Could not reach MusicBrainz. Try again in a moment.");
    }
    setLoading(false);
  };

  const handleSelect = async (result) => {
    setLoading(true);
    setError(null);
    try {
      const album = await fetchReleaseDetails(result.mbid, result.artist);
      setPreview(album);
    } catch (e) {
      setError("Failed to load album details.");
    }
    setLoading(false);
  };

  const inputStyle = {
    padding: "8px 12px",
    background: "var(--bg)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-sm)",
    color: "var(--fg)",
    fontSize: 12,
    outline: "none",
    flex: 1,
    minWidth: 140,
  };

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)",
      padding: "16px 20px",
      marginBottom: "var(--space-md)",
    }}>
      {/* Search fields */}
      {!preview && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <input
              className="mono"
              placeholder="Album title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              style={inputStyle}
              autoFocus
            />
            <input
              className="mono"
              placeholder="Artist (optional)"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              style={inputStyle}
            />
            <button
              onClick={handleSearch}
              disabled={loading || !title.trim()}
              className="mono"
              style={{
                padding: "8px 18px",
                background: "var(--fg)",
                color: "var(--bg)",
                borderRadius: "var(--radius-sm)",
                fontSize: 11,
                fontWeight: 600,
                opacity: loading || !title.trim() ? 0.4 : 1,
              }}
            >
              {loading ? "Searching..." : "Search"}
            </button>
            <button
              onClick={onClose}
              className="mono"
              style={{ padding: "8px 12px", color: "var(--fg-muted)", fontSize: 11 }}
            >
              Cancel
            </button>
          </div>

          {error && (
            <p className="mono" style={{ color: "#c44", fontSize: 11, marginBottom: 8 }}>{error}</p>
          )}

          {/* Search results */}
          {results && (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <p className="mono" style={{ fontSize: 10, color: "var(--fg-ghost)", marginBottom: 4 }}>
                {results.length} result{results.length !== 1 ? "s" : ""} — click to select
              </p>
              {results.map((r) => (
                <button
                  key={r.mbid}
                  onClick={() => handleSelect(r)}
                  className="mono"
                  style={{
                    textAlign: "left",
                    padding: "6px 10px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 11,
                    color: "var(--fg)",
                    background: "transparent",
                    transition: "var(--ease-default)",
                  }}
                  onMouseEnter={(e) => (e.target.style.background = "var(--surface-hover)")}
                  onMouseLeave={(e) => (e.target.style.background = "transparent")}
                >
                  <span style={{ fontWeight: 600 }}>{r.title}</span>
                  <span style={{ color: "var(--fg-muted)" }}>
                    {" "}— {r.artist} · {r.year || "?"} · {r.label || "?"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Preview */}
      {preview && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>{preview.title}</h3>
              <p className="mono" style={{ fontSize: 11, color: "var(--fg-dim)" }}>
                {preview.artist} · {preview.year || "?"} · {preview.label || "?"}
              </p>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => onAdd(preview)}
                className="mono"
                style={{
                  padding: "7px 18px",
                  background: "var(--fg)",
                  color: "var(--bg)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                Add Album
              </button>
              <button
                onClick={() => { setPreview(null); setResults(null); }}
                className="mono"
                style={{ padding: "7px 12px", color: "var(--fg-muted)", fontSize: 11 }}
              >
                Back
              </button>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {preview.lineup.map((m) => (
              <span
                key={m.name}
                className="pill"
                style={{
                  background: "var(--surface-hover)",
                  color: "var(--fg-muted)",
                  borderLeft: `2px solid ${instrumentColor(m.instrument)}`,
                  fontWeight: m.lead ? 700 : 400,
                }}
              >
                {m.lead ? "★ " : ""}{m.name} — {m.instrument}
              </span>
            ))}
          </div>
          {preview.lineup.length === 0 && (
            <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)" }}>
              No lineup data found on MusicBrainz.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
