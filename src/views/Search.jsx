import { useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useData } from "../App";
import { instrumentColor, slugify } from "../data";

export default function Search() {
  const { albums, index } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";

  const setQuery = useCallback((v) => {
    setSearchParams((p) => { v ? p.set("q", v) : p.delete("q"); return p; }, { replace: true });
  }, [setSearchParams]);

  const results = useMemo(() => {
    if (!query || query.length < 2) return null;
    const s = query.toLowerCase();

    const matchedAlbums = albums.filter(
      (a) => a.title.toLowerCase().includes(s) || a.artist.toLowerCase().includes(s)
    );

    const matchedArtists = index.musicians.filter(
      (m) => m.name.toLowerCase().includes(s)
    );

    const matchedTracks = [];
    for (const album of albums) {
      if (!album.tracks) continue;
      for (const track of album.tracks) {
        if (track.title.toLowerCase().includes(s)) {
          matchedTracks.push({ track, album });
        }
      }
    }

    return { albums: matchedAlbums, artists: matchedArtists, tracks: matchedTracks };
  }, [query, albums, index]);

  const total = results ? results.albums.length + results.artists.length + results.tracks.length : 0;

  return (
    <div style={{ padding: "0 var(--space-xl) var(--space-3xl)", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ padding: "var(--space-lg) 0 var(--space-xl)" }}>
        <input
          type="text"
          placeholder="Search albums, artists, tracks..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          className="mono"
          style={{
            width: "100%",
            padding: "14px 20px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            color: "var(--fg)",
            fontSize: 14,
            outline: "none",
          }}
        />
      </div>

      {!query && (
        <p className="mono" style={{ color: "var(--fg-muted)", fontSize: 13, textAlign: "center", padding: "60px 0" }}>
          Search across {albums.length.toLocaleString()} albums, {index.musicians.length.toLocaleString()} musicians, and thousands of tracks.
        </p>
      )}

      {query && query.length < 2 && (
        <p className="mono" style={{ color: "var(--fg-muted)", fontSize: 13, textAlign: "center", padding: "60px 0" }}>
          Type at least 2 characters to search.
        </p>
      )}

      {results && total === 0 && (
        <p className="mono" style={{ color: "var(--fg-muted)", fontSize: 13, textAlign: "center", padding: "60px 0" }}>
          No results for "{query}"
        </p>
      )}

      {results && results.albums.length > 0 && (
        <section style={{ marginBottom: "var(--space-2xl)" }}>
          <SectionHeader label="Albums" count={results.albums.length} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {results.albums.map((album) => (
              <Link key={album.id} to={`/album/${album.id}`} className="search-row" style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 12px", borderRadius: "var(--radius-md)", textDecoration: "none" }}>
                <div style={{ width: 44, height: 44, borderRadius: "var(--radius-sm)", overflow: "hidden", background: "var(--surface)", flexShrink: 0 }}>
                  {album.coverPath && (
                    <img src={`/data/${album.coverPath}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {album.title}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                    {album.artist} · {album.year || "?"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {results && results.artists.length > 0 && (
        <section style={{ marginBottom: "var(--space-2xl)" }}>
          <SectionHeader label="Artists" count={results.artists.length} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {results.artists.map((artist) => (
              <Link key={artist.slug} to={`/artist/${artist.slug}`} className="search-row" style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 12px", borderRadius: "var(--radius-md)", textDecoration: "none" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", background: "var(--surface)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 16, color: instrumentColor(artist.primary) }}>
                    {artist.name.charAt(0)}
                  </span>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {artist.name}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                    {artist.primary} · {artist.albums.length} album{artist.albums.length !== 1 ? "s" : ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {results && results.tracks.length > 0 && (
        <section style={{ marginBottom: "var(--space-2xl)" }}>
          <SectionHeader label="Tracks" count={results.tracks.length} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {results.tracks.map(({ track, album }, i) => (
              <Link key={`${album.id}-${track.position}-${i}`} to={`/album/${album.id}`} className="search-row" style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 12px", borderRadius: "var(--radius-md)", textDecoration: "none" }}>
                <div style={{ width: 44, height: 44, borderRadius: "var(--radius-sm)", overflow: "hidden", background: "var(--surface)", flexShrink: 0 }}>
                  {album.coverPath && (
                    <img src={`/data/${album.coverPath}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {track.title}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                    {album.title} · {album.artist}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeader({ label, count }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
      <h2 style={{ fontSize: 18, fontWeight: 300, textTransform: "lowercase" }}>{label}</h2>
      <span className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)" }}>{count}</span>
    </div>
  );
}
