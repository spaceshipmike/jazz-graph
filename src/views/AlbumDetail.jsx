import { useParams, Link } from "react-router-dom";
import { useData } from "../App";
import { instrumentColor, labelColor, slugify } from "../data";
import { useMemo } from "react";

function formatDuration(ms) {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export default function AlbumDetail() {
  const { slug } = useParams();
  const { albums, index } = useData();

  const album = index?.albumsBySlug.get(slug);

  const connected = useMemo(() => {
    if (!album || !index) return [];
    const musicianNames = new Set(album.lineup.map((m) => m.name));
    const connections = new Map();

    for (const a of albums) {
      if (a.id === album.id) continue;
      const shared = a.lineup.filter((m) => musicianNames.has(m.name));
      if (shared.length > 0) {
        connections.set(a.id, { album: a, shared });
      }
    }

    return [...connections.values()]
      .sort((a, b) => b.shared.length - a.shared.length)
      .slice(0, 12);
  }, [album, albums, index]);

  if (!album) {
    return (
      <div style={{ padding: "60px var(--space-xl)", textAlign: "center" }}>
        <p className="mono" style={{ color: "var(--fg-muted)" }}>Album not found.</p>
        <Link to="/" className="mono" style={{ color: "var(--fg-dim)", fontSize: 12 }}>Back to gallery</Link>
      </div>
    );
  }

  const coverSrc = album.coverPath ? `/data/${album.coverPath}` : null;

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)", maxWidth: 800, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", gap: "var(--space-xl)", marginBottom: "var(--space-2xl)", flexWrap: "wrap" }}>
        <div style={{ width: 280, flexShrink: 0, borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--surface)" }}>
          {coverSrc ? (
            <img src={coverSrc} alt={album.title} className="cover-img" onLoad={(e) => e.target.classList.add("loaded")} style={{ aspectRatio: "1" }} />
          ) : (
            <div style={{ width: "100%", aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="mono" style={{ color: "var(--fg-ghost)" }}>No cover</span>
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.1, marginBottom: 8 }}>{album.title}</h1>
          <Link to={`/artist/${slugify(album.artist)}`} className="mono" style={{ fontSize: 14, color: labelColor(album.label), marginBottom: 4, display: "block", textDecoration: "none" }}>
            {album.artist}
          </Link>
          <p className="mono" style={{ fontSize: 12, color: "var(--fg-muted)" }}>
            <Link to={`/time?year=${album.year}`} style={{ color: "inherit", textDecoration: "none" }}>{album.year || "?"}</Link>
            {" · "}
            <Link to={`/?q=${encodeURIComponent(album.label || "")}`} style={{ color: "inherit", textDecoration: "none" }}>{album.label || "Unknown label"}</Link>
          </p>
        </div>
      </div>

      {/* Track Listing */}
      {album.tracks && album.tracks.length > 0 && (
        <section style={{ marginBottom: "var(--space-2xl)" }}>
          <h3 className="mono" style={{ fontSize: 10, color: "var(--fg-ghost)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "var(--space-sm)" }}>
            Tracks
          </h3>
          {album.tracks.map((t) => (
            <div
              key={t.position}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 12px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="mono" style={{ fontSize: 10, color: "var(--fg-ghost)", width: 20, textAlign: "right" }}>
                  {t.position}
                </span>
                <span style={{ fontSize: 13, color: "var(--fg-dim)" }}>{t.title}</span>
              </div>
              {t.lengthMs && (
                <span className="mono" style={{ fontSize: 10, color: "var(--fg-ghost)" }}>
                  {formatDuration(t.lengthMs)}
                </span>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Lineup */}
      <section style={{ marginBottom: "var(--space-2xl)" }}>
        <h3 className="mono" style={{ fontSize: 10, color: "var(--fg-ghost)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "var(--space-sm)" }}>
          Lineup
        </h3>
        {album.lineup.map((m) => (
          <Link
            key={m.name}
            to={`/artist/${slugify(m.name)}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              borderRadius: "var(--radius-md)",
              background: "var(--surface)",
              borderLeft: `3px solid ${instrumentColor(m.instrument)}`,
              marginBottom: 3,
              textDecoration: "none",
              transition: "var(--ease-default)",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: m.lead ? 700 : 400, color: m.lead ? "var(--fg)" : "var(--fg-dim)" }}>
              {m.lead ? "★ " : ""}
              {m.name}
            </span>
            <span className="mono" style={{ fontSize: 10, color: instrumentColor(m.instrument) }}>
              {m.instrument}
            </span>
          </Link>
        ))}
      </section>

      {/* Connected Albums */}
      {connected.length > 0 && (
        <section>
          <h3 className="mono" style={{ fontSize: 10, color: "var(--fg-ghost)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "var(--space-sm)" }}>
            Connected Albums
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "var(--space-sm)" }}>
            {connected.map(({ album: a, shared }) => (
              <Link
                key={a.id}
                to={`/album/${a.id}`}
                style={{
                  display: "flex",
                  gap: "var(--space-sm)",
                  padding: "10px 12px",
                  background: "var(--surface)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  textDecoration: "none",
                  transition: "var(--ease-default)",
                }}
              >
                <div style={{ width: 48, height: 48, borderRadius: "var(--radius-sm)", overflow: "hidden", flexShrink: 0, background: "var(--bg)" }}>
                  {a.coverPath ? (
                    <img src={`/data/${a.coverPath}`} alt={a.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                  ) : null}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</div>
                  <div className="mono" style={{ fontSize: 9, color: "var(--fg-muted)" }}>{a.artist} · {a.year}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 }}>
                    {shared.map((m) => (
                      <span key={m.name} className="mono" style={{
                        fontSize: 8, color: instrumentColor(m.instrument),
                        background: `${instrumentColor(m.instrument)}15`,
                        padding: "1px 4px", borderRadius: 3,
                      }}>
                        {m.name} <span style={{ opacity: 0.6 }}>({m.instrument})</span>
                      </span>
                    ))}
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
