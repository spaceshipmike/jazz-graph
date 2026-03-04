import { useParams, Link, useNavigate } from "react-router-dom";
import { useData } from "../App";
import { instrumentColor, labelColor, slugify } from "../data";
import { useMemo } from "react";

export default function AlbumDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { albums, index, onRemoveAlbum } = useData();

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
          <p className="mono" style={{ fontSize: 14, color: labelColor(album.label), marginBottom: 4 }}>
            {album.artist}
          </p>
          <p className="mono" style={{ fontSize: 12, color: "var(--fg-muted)" }}>
            {album.year || "?"} · {album.label || "Unknown label"}
          </p>
          {album.userAdded && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <span className="mono" style={{
                padding: "3px 8px", borderRadius: "var(--radius-sm)",
                border: "1px dashed var(--fg-ghost)", fontSize: 9,
                color: "var(--fg-muted)", letterSpacing: "0.05em",
              }}>
                USER ADDED
              </span>
              <button
                onClick={() => {
                  onRemoveAlbum(album.id);
                  navigate("/");
                }}
                className="mono"
                style={{
                  padding: "3px 8px", borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)", fontSize: 9,
                  color: "var(--fg-muted)",
                }}
              >
                Remove
              </button>
              <a
                href={`https://github.com/spaceshipmike/jazz-graph/issues/new?title=${encodeURIComponent(`Add album: ${album.title} — ${album.artist}`)}&body=${encodeURIComponent(`## Album Submission\n\n- **Title:** ${album.title}\n- **Artist:** ${album.artist}\n- **Year:** ${album.year || "?"}\n- **Label:** ${album.label || "?"}\n- **MusicBrainz ID:** ${album.mbid || "?"}\n\nSubmitted via The Jazz Graph "Add Album" feature.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mono"
                style={{
                  padding: "3px 8px", borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--fg-ghost)", fontSize: 9,
                  color: "var(--fg-dim)", textDecoration: "none",
                }}
              >
                Submit to project →
              </a>
            </div>
          )}
        </div>
      </div>

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
                  <div className="mono" style={{ fontSize: 9, color: "var(--fg-ghost)", marginTop: 2 }}>
                    {shared.map((m) => m.name.split(" ").pop()).join(", ")}
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
