import { useMemo } from "react";
import { Link } from "react-router-dom";
import { PlayableAlbumArt } from "./SpotifyUI";
import { useSpotify } from "../spotify";

/**
 * Find albums whose title (or any track title) contains one of the keywords
 * as a whole word. Returns [{ album, albumMatch, tracks }] sorted by
 * match strength. Same matching rules as the keyword counts in titleAnalysis,
 * so the drill-down numbers line up with the chart bubbles.
 */
export function findKeywordMatches(albums, keywords) {
  const regexes = keywords.map((k) => new RegExp(`\\b${k}\\b`, "i"));
  const matches = new Map();
  for (const a of albums) {
    const albumMatch = regexes.some((r) => r.test(a.title));
    const tracks = (a.tracks || []).filter((t) => regexes.some((r) => r.test(t.title)));
    if (albumMatch || tracks.length > 0) {
      matches.set(a.id, { album: a, albumMatch, tracks });
    }
  }
  return [...matches.values()].sort(
    (a, b) => (b.albumMatch ? 1 : 0) + b.tracks.length - ((a.albumMatch ? 1 : 0) + a.tracks.length),
  );
}

/**
 * Album results panel for keyword drill-downs (Words views).
 * Renders nothing when there are no matches.
 */
export default function KeywordAlbums({ albums, keywords, color, label, max = 40 }) {
  const { isLoggedIn } = useSpotify();
  const matches = useMemo(
    () => (keywords && keywords.length ? findKeywordMatches(albums, keywords) : []),
    [albums, keywords],
  );

  if (matches.length === 0) return null;

  return (
    <div style={{ marginTop: "var(--space-lg)" }}>
      <h3 className="mono" style={{ fontSize: 10, color: "var(--fg-ghost)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "var(--space-sm)" }}>
        <span style={{ color }}>{label}</span> — {matches.length} albums
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 6 }}>
        {matches.slice(0, max).map(({ album: a, albumMatch, tracks }) => (
          <div
            key={a.id}
            style={{
              display: "flex",
              gap: "var(--space-sm)",
              padding: "8px 10px",
              background: "var(--surface)",
              borderRadius: "var(--radius-sm)",
              borderLeft: `3px solid ${color}`,
              textDecoration: "none",
              transition: "var(--ease-default)",
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 3, overflow: "hidden", flexShrink: 0, background: "var(--bg)" }}>
              {a.coverPath ? (
                isLoggedIn ? (
                  <PlayableAlbumArt album={a}>
                    <img src={`/data/${a.coverPath}`} alt={a.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                  </PlayableAlbumArt>
                ) : (
                  <img src={`/data/${a.coverPath}`} alt={a.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                )
              ) : null}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link to={`/album/${a.id}`} style={{ display: "block", fontSize: 12, fontWeight: albumMatch ? 600 : 400, color: albumMatch ? "var(--fg)" : "var(--fg-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {a.title}
              </Link>
              <div className="mono" style={{ fontSize: 9, color: "var(--fg-muted)" }}>
                {a.artist} · {a.year || "?"}
              </div>
              {tracks.length > 0 && (
                <div className="mono" style={{ fontSize: 8, color, marginTop: 2 }}>
                  {tracks.slice(0, 3).map((t) => t.title).join(", ")}
                  {tracks.length > 3 && ` +${tracks.length - 3}`}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {matches.length > max && (
        <p className="mono" style={{ fontSize: 9, color: "var(--fg-ghost)", marginTop: 8 }}>
          +{matches.length - max} more
        </p>
      )}
    </div>
  );
}
