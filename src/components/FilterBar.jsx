import { useState, useMemo, useRef, useEffect } from "react";
import { familyColor, FAMILIES, LABELS } from "../data";
import { useData } from "../App";

const FAMILY_LIST = Object.keys(FAMILIES);

/**
 * Shared filter bar: instrument family pills, top label pills, artist autocomplete.
 * All state is driven via URL search params passed in as props.
 */
export default function FilterBar({ family, setFamily, label, setLabel, artist, setArtist }) {
  const { albums, index } = useData();
  const [artistQuery, setArtistQuery] = useState(artist || "");
  const [showAllLabels, setShowAllLabels] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const suggestRef = useRef(null);

  // Top labels by album count
  const topLabels = useMemo(() => {
    const counts = new Map();
    for (const a of albums) {
      const l = a.label || "Unknown";
      counts.set(l, (counts.get(l) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .filter(([name]) => name in LABELS);
  }, [albums]);

  const visibleLabels = showAllLabels ? topLabels : topLabels.slice(0, 8);

  // Artist suggestions
  const suggestions = useMemo(() => {
    if (!artistQuery || artistQuery.length < 2 || !index) return [];
    const q = artistQuery.toLowerCase();
    return index.musicians
      .filter((m) => m.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [artistQuery, index]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e) {
      if (
        suggestRef.current && !suggestRef.current.contains(e.target) &&
        inputRef.current && !inputRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Sync external artist prop
  useEffect(() => {
    if (!artist) setArtistQuery("");
  }, [artist]);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", padding: "12px 0" }}>
      {/* Instrument family pills */}
      {FAMILY_LIST.map((f) => {
        const active = family === f;
        const color = familyColor(f);
        return (
          <button
            key={f}
            className="pill"
            onClick={() => setFamily(active ? null : f)}
            style={{
              background: active ? color + "33" : "var(--surface)",
              border: `1px solid ${active ? color : "var(--border)"}`,
              color: active ? color : "var(--fg-muted)",
              fontWeight: active ? 700 : 400,
            }}
          >
            {f}
          </button>
        );
      })}

      {/* Separator */}
      <div style={{ width: 1, height: 18, background: "var(--border)", margin: "0 4px" }} />

      {/* Label pills */}
      {visibleLabels.map(([name]) => {
        const active = label === name;
        const color = LABELS[name] || "#888";
        return (
          <button
            key={name}
            className="pill"
            onClick={() => setLabel(active ? null : name)}
            style={{
              background: active ? color + "33" : "var(--surface)",
              border: `1px solid ${active ? color : "var(--border)"}`,
              color: active ? color : "var(--fg-muted)",
              fontWeight: active ? 700 : 400,
            }}
          >
            {name}
          </button>
        );
      })}
      {!showAllLabels && topLabels.length > 8 && (
        <button
          className="pill"
          onClick={() => setShowAllLabels(true)}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--fg-ghost)",
          }}
        >
          +{topLabels.length - 8} more
        </button>
      )}
      {showAllLabels && topLabels.length > 8 && (
        <button
          className="pill"
          onClick={() => setShowAllLabels(false)}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--fg-ghost)",
          }}
        >
          less
        </button>
      )}

      {/* Separator */}
      <div style={{ width: 1, height: 18, background: "var(--border)", margin: "0 4px" }} />

      {/* Artist search */}
      <div style={{ position: "relative" }}>
        {artist ? (
          <button
            className="pill"
            onClick={() => { setArtist(null); setArtistQuery(""); }}
            style={{
              background: "var(--fg)" + "18",
              border: "1px solid var(--fg-dim)",
              color: "var(--fg)",
              fontWeight: 600,
            }}
          >
            {artist} <span style={{ opacity: 0.5 }}>×</span>
          </button>
        ) : (
          <input
            ref={inputRef}
            type="text"
            placeholder="Artist..."
            value={artistQuery}
            onChange={(e) => { setArtistQuery(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            className="mono"
            style={{
              padding: "4px 10px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-pill)",
              color: "var(--fg)",
              fontSize: 10,
              outline: "none",
              width: 120,
            }}
          />
        )}
        {showSuggestions && suggestions.length > 0 && !artist && (
          <div
            ref={suggestRef}
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: 4,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
              zIndex: 100,
              minWidth: 200,
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            {suggestions.map((m) => (
              <button
                key={m.slug}
                onClick={() => {
                  setArtist(m.name);
                  setArtistQuery(m.name);
                  setShowSuggestions(false);
                }}
                className="mono"
                style={{
                  display: "block",
                  width: "100%",
                  padding: "7px 12px",
                  background: "transparent",
                  border: "none",
                  color: "var(--fg)",
                  fontSize: 11,
                  textAlign: "left",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {m.name}
                <span style={{ color: "var(--fg-ghost)", marginLeft: 8 }}>
                  {m.primary}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
