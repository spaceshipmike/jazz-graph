import { useParams, Link, useNavigate } from "react-router-dom";
import { useData } from "../App";
import { instrumentColor, labelColor, slugify } from "../data";
import { useMemo, useRef, useEffect } from "react";
import * as d3 from "d3";

export default function ArtistDetail() {
  const { slug } = useParams();
  const { index, artistPhotos, albums } = useData();

  const artist = index?.artistsBySlug.get(slug);

  const collaborators = useMemo(() => {
    if (!artist) return [];
    const map = new Map();
    for (const album of artist.albums) {
      const full = albums.find((a) => a.id === album.id);
      if (!full) continue;
      for (const m of full.lineup) {
        if (m.name !== artist.name) {
          if (!map.has(m.name)) map.set(m.name, { name: m.name, count: 0, instruments: new Set() });
          const entry = map.get(m.name);
          entry.count++;
          entry.instruments.add(m.instrument);
        }
      }
    }
    return [...map.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .map((c) => ({ ...c, instruments: [...c.instruments] }));
  }, [artist, albums]);

  if (!artist) {
    return (
      <div style={{ padding: "60px var(--space-xl)", textAlign: "center" }}>
        <p className="mono" style={{ color: "var(--fg-muted)" }}>Artist not found.</p>
        <Link to="/" className="mono" style={{ color: "var(--fg-dim)", fontSize: 12 }}>Back to gallery</Link>
      </div>
    );
  }

  const photoPath = artistPhotos[artist.name];
  const sortedAlbums = [...artist.albums].sort((a, b) => (a.year || 0) - (b.year || 0));
  const yearRange = sortedAlbums.length > 0 ? [sortedAlbums[0].year, sortedAlbums[sortedAlbums.length - 1].year] : [null, null];

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)", maxWidth: 900, margin: "0 auto" }}>
      {/* Back link */}
      <Link to="/" className="mono" style={{ fontSize: 11, color: "var(--fg-muted)", display: "inline-block", marginBottom: "var(--space-lg)" }}>
        ← Back to gallery
      </Link>

      {/* Header */}
      <div style={{ display: "flex", gap: "var(--space-xl)", marginBottom: "var(--space-2xl)", alignItems: "flex-start", flexWrap: "wrap" }}>
        {photoPath && (
          <div style={{ width: 160, height: 160, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: `2px solid ${instrumentColor(artist.primary)}` }}>
            <img src={`/data/${photoPath}`} alt={artist.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}
        <div>
          <h1 style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.1, marginBottom: 8 }}>{artist.name}</h1>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            {artist.instruments.map((inst) => (
              <span key={inst} className="pill" style={{ background: instrumentColor(inst), color: "#fff", fontSize: 10 }}>
                {inst}
              </span>
            ))}
          </div>
          <p className="mono" style={{ fontSize: 12, color: "var(--fg-muted)" }}>
            {artist.albums.length} albums · {artist.leadAlbums.length} as leader
            {yearRange[0] && ` · ${yearRange[0]}–${yearRange[1]}`}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <section style={{ marginBottom: "var(--space-2xl)" }}>
        <h3 className="mono" style={{ fontSize: 10, color: "var(--fg-ghost)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "var(--space-md)" }}>
          Timeline
        </h3>
        <Timeline albums={sortedAlbums} artistName={artist.name} />
      </section>

      {/* Discography Grid */}
      <section style={{ marginBottom: "var(--space-2xl)" }}>
        <h3 className="mono" style={{ fontSize: 10, color: "var(--fg-ghost)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "var(--space-sm)" }}>
          Discography
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "var(--space-sm)" }}>
          {sortedAlbums.map((a) => (
            <Link key={a.id} to={`/album/${a.id}`} style={{ textAlign: "center", textDecoration: "none" }}>
              <div style={{ borderRadius: "var(--radius-sm)", overflow: "hidden", opacity: a._lead ? 1 : 0.6, background: "var(--surface)", aspectRatio: "1" }}>
                {a.coverPath ? (
                  <img src={`/data/${a.coverPath}`} alt={a.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span className="mono" style={{ fontSize: 8, color: "var(--fg-ghost)" }}>?</span>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 10, fontWeight: a._lead ? 700 : 400, marginTop: 4, lineHeight: 1.2 }}>
                {a._lead && <span style={{ color: instrumentColor(a._inst) }}>★ </span>}
                {a.title.length > 18 ? a.title.slice(0, 16) + "…" : a.title}
              </div>
              <div className="mono" style={{ fontSize: 9, color: "var(--fg-muted)" }}>{a.year || "?"}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Collaborators */}
      {collaborators.length > 0 && (
        <section>
          <h3 className="mono" style={{ fontSize: 10, color: "var(--fg-ghost)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "var(--space-sm)" }}>
            Top Collaborators
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {collaborators.map((c) => (
              <Link
                key={c.name}
                to={`/artist/${slugify(c.name)}`}
                className="pill"
                style={{
                  background: "var(--surface)",
                  color: "var(--fg-dim)",
                  border: "1px solid var(--border)",
                  fontSize: 10,
                  textDecoration: "none",
                }}
              >
                {c.name} <span style={{ opacity: 0.4 }}>({c.count})</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Timeline({ albums, artistName }) {
  const svgRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!svgRef.current || albums.length === 0) return;

    const years = albums.map((a) => a.year).filter(Boolean);
    if (years.length === 0) return;

    const margin = { top: 20, right: 30, bottom: 30, left: 30 };
    const width = svgRef.current.parentElement.clientWidth;
    const height = 120;
    const inner = { w: width - margin.left - margin.right, h: height - margin.top - margin.bottom };

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain([d3.min(years) - 1, d3.max(years) + 1])
      .range([0, inner.w]);

    // Axis
    g.append("g")
      .attr("transform", `translate(0,${inner.h})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(Math.min(years.length, 10)))
      .call((g) => g.select(".domain").attr("stroke", "#333"))
      .call((g) => g.selectAll(".tick line").attr("stroke", "#222"))
      .call((g) => g.selectAll(".tick text").attr("fill", "#555").attr("font-family", "'JetBrains Mono'").attr("font-size", 9));

    // Timeline line
    g.append("line")
      .attr("x1", 0).attr("y1", inner.h / 2)
      .attr("x2", inner.w).attr("y2", inner.h / 2)
      .attr("stroke", "#222").attr("stroke-width", 1);

    // Album nodes
    const nodes = g.selectAll("circle").data(albums.filter((a) => a.year)).join("circle")
      .attr("cx", (d) => x(d.year))
      .attr("cy", inner.h / 2)
      .attr("r", (d) => d._lead ? 8 : 5)
      .attr("fill", (d) => d._lead ? instrumentColor(d._inst) : "var(--fg-ghost)")
      .attr("fill-opacity", (d) => d._lead ? 0.9 : 0.4)
      .attr("stroke", (d) => d._lead ? instrumentColor(d._inst) : "none")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.5)
      .style("cursor", "pointer");

    // Tooltips
    const tip = g.append("g").style("display", "none");
    const tipBg = tip.append("rect").attr("fill", "#1a1a1e").attr("stroke", "#333").attr("rx", 4).attr("ry", 4);
    const tipText = tip.append("text").attr("fill", "#ccc").attr("font-family", "'JetBrains Mono'").attr("font-size", 10);

    nodes
      .on("mouseover", (event, d) => {
        const label = `${d.title} (${d.year})`;
        tipText.text(label);
        const bbox = tipText.node().getBBox();
        tipBg.attr("x", bbox.x - 6).attr("y", bbox.y - 3).attr("width", bbox.width + 12).attr("height", bbox.height + 6);
        tip.attr("transform", `translate(${x(d.year)},${inner.h / 2 - 22})`).style("display", null);
        d3.select(event.target).attr("fill-opacity", 1).attr("r", (d) => d._lead ? 10 : 7);
      })
      .on("mouseout", (event, d) => {
        tip.style("display", "none");
        d3.select(event.target).attr("fill-opacity", (d) => d._lead ? 0.9 : 0.4).attr("r", (d) => d._lead ? 8 : 5);
      })
      .on("click", (event, d) => {
        navigate(`/album/${d.id}`);
      });

  }, [albums]);

  return (
    <div style={{ background: "var(--surface)", borderRadius: "var(--radius-md)", padding: "var(--space-sm)", border: "1px solid var(--border)" }}>
      <svg ref={svgRef} style={{ display: "block", width: "100%" }} />
      <div className="mono" style={{ display: "flex", gap: 16, fontSize: 9, color: "var(--fg-ghost)", padding: "4px 8px 0" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--fg-dim)", display: "inline-block" }} /> Leader
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--fg-ghost)", display: "inline-block" }} /> Sideperson
        </span>
      </div>
    </div>
  );
}
