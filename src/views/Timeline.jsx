import { useMemo, useEffect, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useData } from "../App";
import { instrumentFamily, labelColor } from "../data";
import FilterBar from "../components/FilterBar";

export default function Timeline() {
  const { albums } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetYear = searchParams.get("year");
  const familyFilter = searchParams.get("family") || null;
  const labelFilter = searchParams.get("label") || null;
  const artistFilter = searchParams.get("artist") || null;
  const yearRefs = useRef({});

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
  }, [albums, familyFilter, labelFilter, artistFilter]);

  const byYear = useMemo(() => {
    const map = new Map();
    for (const a of filtered) {
      if (!a.year) continue;
      if (!map.has(a.year)) map.set(a.year, []);
      map.get(a.year).push(a);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  useEffect(() => {
    if (targetYear && yearRefs.current[targetYear]) {
      yearRefs.current[targetYear].scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [targetYear, byYear]);

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)", maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 0 }}>Timeline</h1>

      <FilterBar
        family={familyFilter}
        setFamily={setFamilyFilter}
        label={labelFilter}
        setLabel={setLabelFilter}
        artist={artistFilter}
        setArtist={setArtistFilter}
      />

      {filtered.length !== albums.length && (
        <div className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-md)" }}>
          {filtered.length} of {albums.length} albums
        </div>
      )}

      <div style={{ position: "relative", paddingLeft: 28 }}>
        {/* Vertical line */}
        <div style={{
          position: "absolute", left: 10, top: 0, bottom: 0, width: 1,
          background: "var(--border)",
        }} />

        {byYear.map(([year, items]) => (
          <section
            key={year}
            ref={(el) => { yearRefs.current[year] = el; }}
            style={{ marginBottom: 32, position: "relative" }}
          >
            {/* Dot on the line */}
            <div style={{
              position: "absolute", left: -23, top: 6, width: 7, height: 7,
              borderRadius: "50%", background: year == targetYear ? "var(--fg)" : "var(--fg-ghost)",
            }} />
            <h2
              className="mono"
              style={{
                fontSize: year == targetYear ? 28 : 18,
                fontWeight: 800,
                color: year == targetYear ? "var(--fg)" : "var(--fg-dim)",
                marginBottom: 10,
                transition: "all 300ms ease",
              }}
            >
              {year}
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {items.map((album) => (
                <Link
                  key={album.id}
                  to={`/album/${album.id}`}
                  title={`${album.title} — ${album.artist}`}
                  style={{
                    width: 88, flexShrink: 0, textDecoration: "none",
                    borderRadius: "var(--radius-sm)", overflow: "hidden",
                    border: `1px solid ${labelColor(album.label)}33`,
                    transition: "var(--ease-default)",
                  }}
                >
                  <div style={{ aspectRatio: "1", background: "var(--surface)", overflow: "hidden" }}>
                    {album.coverPath ? (
                      <img
                        src={`/data/${album.coverPath}`}
                        alt={album.title}
                        loading="lazy"
                        className="cover-img"
                        onLoad={(e) => e.target.classList.add("loaded")}
                      />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span className="mono" style={{ color: "var(--fg-ghost)", fontSize: 7 }}>No cover</span>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "4px 5px" }}>
                    <div style={{
                      fontSize: 8, fontWeight: 600, lineHeight: 1.2,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {album.title}
                    </div>
                    <div className="mono" style={{ fontSize: 7, color: labelColor(album.label) }}>
                      {album.artist}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {byYear.length === 0 && (
          <p className="mono" style={{ color: "var(--fg-muted)", fontSize: 13, textAlign: "center", padding: "60px 0" }}>
            No albums match your filters.
          </p>
        )}
      </div>
    </div>
  );
}
