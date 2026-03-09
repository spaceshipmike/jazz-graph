import { useData } from "../App";

export default function About() {
  const { albums, index } = useData();

  const artistCount = index?.musicians?.length || 0;
  const labelSet = new Set(albums.map((a) => a.label).filter(Boolean));
  const labelCount = labelSet.size;
  const withCovers = albums.filter((a) => a.coverPath).length;

  return (
    <div style={{ padding: "var(--space-3xl) var(--space-xl)", maxWidth: 640, margin: "0 auto" }}>
      <h2 style={{
        fontFamily: "var(--font-display)",
        fontSize: 28,
        fontWeight: 300,
        lineHeight: 1.1,
        marginBottom: "var(--space-lg)",
      }}>
        What is this?
      </h2>

      <p style={{ fontSize: 18, lineHeight: 1.7, color: "var(--fg)", marginBottom: "var(--space-lg)" }}>
        The Jazz Graph is an interactive visual encyclopedia of jazz. It takes{" "}
        <strong>{albums.length.toLocaleString()}</strong> albums,{" "}
        <strong>{artistCount.toLocaleString()}</strong> musicians, and{" "}
        <strong>{labelCount}</strong> record labels and attempts to reveal
        hidden structures of the music through seven thematic
        lenses — color, artists, instruments, labels, time, sound, and words.
      </p>

      <p style={{ fontSize: 18, lineHeight: 1.7, color: "var(--fg)", marginBottom: "var(--space-lg)" }}>
        Every album has real cover art, session lineups, and track listings
        sourced from MusicBrainz and Spotify. The design is a love letter to
        Reid Miles' iconic Blue Note Records covers from the 1950s and 60s.
      </p>

      <p style={{ fontSize: 18, lineHeight: 1.7, color: "var(--fg)", marginBottom: "var(--space-lg)" }}>
        It was built with Claude Code during a sick afternoon in bed and is far
        from perfect. You may find issues. If you do, send them to{" "}
        <a href="mailto:jazzgraph@h3r3.com" style={{ color: "var(--fg)", borderBottom: "1px solid var(--fg-muted)" }}>
          jazzgraph@h3r3.com
        </a>{" "}
        and I'll try to fix them.
      </p>

      <div style={{
        borderTop: "1px solid var(--border)",
        marginTop: "var(--space-2xl)",
        paddingTop: "var(--space-2xl)",
      }}>
        <p className="mono" style={{
          fontSize: 10,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "var(--fg-muted)",
          marginBottom: "var(--space-md)",
        }}>
          How it's built
        </p>

        <h3 style={{
          fontFamily: "var(--font-display)",
          fontSize: 28,
          fontWeight: 300,
          marginBottom: "var(--space-md)",
        }}>
          Data + Code
        </h3>

        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--fg-dim)", marginBottom: "var(--space-lg)" }}>
          The data pipeline starts with a curated roster of jazz artists, then
          pulls album metadata, session lineups, and track listings from
          MusicBrainz. Cover art comes from Spotify, with the Cover Art Archive
          as fallback. Missing labels are recovered from Discogs. Dominant colors
          are extracted from each cover using sharp. The whole pipeline is
          automated and repeatable.
        </p>

        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--fg-dim)", marginBottom: "var(--space-lg)" }}>
          The front end is a static React app built with Vite, with all
          visualizations rendered using D3.js. There's no backend — everything
          runs in the browser against pre-built JSON and images.
        </p>

        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--fg-dim)", marginBottom: "var(--space-lg)" }}>
          The entire project — data pipeline, visualizations, design, and
          deployment — was built with Claude Code.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)", marginBottom: "var(--space-lg)" }}>
          {[
            { name: "MusicBrainz", url: "https://musicbrainz.org", desc: "album metadata, lineups, tracks" },
            { name: "Spotify", url: "https://developer.spotify.com", desc: "cover art" },
            { name: "Discogs", url: "https://www.discogs.com", desc: "label fallback" },
            { name: "Cover Art Archive", url: "https://coverartarchive.org", desc: "cover art fallback" },
          ].map(({ name, url, desc }) => (
            <a
              key={name}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--fg-dim)",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-pill)",
                padding: "4px 10px",
                textDecoration: "none",
              }}
            >
              {name} <span style={{ color: "var(--fg-ghost)" }}>— {desc}</span>
            </a>
          ))}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)", marginBottom: "var(--space-lg)" }}>
          {["React", "Vite", "D3.js", "sharp", "Claude Code"].map((t) => (
            <span
              key={t}
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--fg-muted)",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-pill)",
                padding: "4px 10px",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div style={{
        borderTop: "1px solid var(--border)",
        marginTop: "var(--space-2xl)",
        paddingTop: "var(--space-2xl)",
      }}>
        <p className="mono" style={{
          fontSize: 10,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "var(--fg-muted)",
          marginBottom: "var(--space-md)",
        }}>
          Built by
        </p>

        <h3 style={{
          fontFamily: "var(--font-display)",
          fontSize: 28,
          fontWeight: 300,
          marginBottom: "var(--space-sm)",
        }}>
          Michael Lebowitz
        </h3>

        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--fg-dim)", marginBottom: "var(--space-lg)" }}>
          Founder and Executive Chairman of Big Spaceship.
          Loves to tinker and has <em>way</em> too many side projects.
        </p>

        <div style={{ display: "flex", gap: "var(--space-lg)" }}>
          <a
            href="https://github.com/spaceshipmike"
            target="_blank"
            rel="noopener noreferrer"
            className="mono"
            style={{ fontSize: 12, color: "var(--fg-dim)", borderBottom: "1px solid var(--fg-ghost)", paddingBottom: 2 }}
          >
            GitHub
          </a>
          <a
            href="https://www.linkedin.com/in/mikespcshp/"
            target="_blank"
            rel="noopener noreferrer"
            className="mono"
            style={{ fontSize: 12, color: "var(--fg-dim)", borderBottom: "1px solid var(--fg-ghost)", paddingBottom: 2 }}
          >
            LinkedIn
          </a>
          <a
            href="https://bigspaceship.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mono"
            style={{ fontSize: 12, color: "var(--fg-dim)", borderBottom: "1px solid var(--fg-ghost)", paddingBottom: 2 }}
          >
            Big Spaceship
          </a>
        </div>
      </div>

      <div className="mono" style={{
        marginTop: "var(--space-3xl)",
        paddingTop: "var(--space-lg)",
        borderTop: "1px solid var(--border)",
        fontSize: 10,
        color: "var(--fg-ghost)",
        letterSpacing: "0.05em",
      }}>
        {albums.length.toLocaleString()} albums &middot;{" "}
        {withCovers.toLocaleString()} covers &middot;{" "}
        {artistCount.toLocaleString()} musicians
      </div>
    </div>
  );
}
