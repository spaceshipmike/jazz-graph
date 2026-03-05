import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../App";
import { labelColor } from "../data";
import * as d3 from "d3";

export default function Connections() {
  const { albums } = useData();
  const [mode, setMode] = useState("chord");
  const [minShared, setMinShared] = useState(2);

  // Build connection data shared by both views
  const { connections, connectedAlbums, matrix, labelGroups } = useMemo(() => {
    const conns = [];
    for (let i = 0; i < albums.length; i++) {
      const musiciansA = new Set(albums[i].lineup.map((m) => m.name));
      for (let j = i + 1; j < albums.length; j++) {
        const shared = albums[j].lineup.filter((m) => musiciansA.has(m.name));
        if (shared.length >= minShared) {
          conns.push({ source: i, target: j, albumA: albums[i], albumB: albums[j], shared, weight: shared.length });
        }
      }
    }
    conns.sort((a, b) => b.weight - a.weight);

    const ids = new Set();
    for (const c of conns) { ids.add(c.source); ids.add(c.target); }
    const filtered = [...ids].sort((a, b) => a - b);
    const indexMap = new Map();
    filtered.forEach((origIdx, newIdx) => indexMap.set(origIdx, newIdx));
    const connected = filtered.map((i) => albums[i]);

    // Build chord matrix
    const n = connected.length;
    const mat = Array.from({ length: n }, () => new Float32Array(n));
    for (const c of conns) {
      const si = indexMap.get(c.source);
      const ti = indexMap.get(c.target);
      if (si !== undefined && ti !== undefined) {
        mat[si][ti] = c.weight;
        mat[ti][si] = c.weight;
      }
    }

    // Group albums by label for chord ordering
    const groups = new Map();
    connected.forEach((a, i) => {
      const l = a.label || "Other";
      if (!groups.has(l)) groups.set(l, []);
      groups.get(l).push(i);
    });

    return { connections: conns, connectedAlbums: connected, matrix: mat, labelGroups: groups };
  }, [albums, minShared]);

  return (
    <div style={{ padding: "var(--space-md) var(--space-xl)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", marginBottom: "var(--space-sm)", flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>Album Connections</h2>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 2 }}>
          {["chord", "arc"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="mono"
              style={{
                padding: "4px 14px",
                borderRadius: "var(--radius-pill)",
                border: "1px solid",
                borderColor: mode === m ? "var(--fg-muted)" : "var(--border)",
                background: mode === m ? "var(--surface-hover)" : "transparent",
                color: mode === m ? "var(--fg)" : "var(--fg-muted)",
                fontSize: 10,
                textTransform: "uppercase",
              }}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Min shared filter */}
        <div className="mono" style={{ fontSize: 10, color: "var(--fg-muted)", display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          <span>Min shared:</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setMinShared(n)}
              className="mono"
              style={{
                padding: "2px 8px",
                borderRadius: "var(--radius-pill)",
                border: "1px solid",
                borderColor: minShared === n ? "var(--fg-muted)" : "var(--border)",
                background: minShared === n ? "var(--surface-hover)" : "transparent",
                color: minShared === n ? "var(--fg)" : "var(--fg-muted)",
                fontSize: 10,
              }}
            >
              {n}
            </button>
          ))}
          <span style={{ color: "var(--fg-ghost)" }}>
            {connections.length} connections · {connectedAlbums.length} albums
          </span>
        </div>
      </div>

      {mode === "chord" ? (
        <ChordDiagram
          albums={connectedAlbums}
          matrix={matrix}
          labelGroups={labelGroups}
          connections={connections}
        />
      ) : (
        <ArcDiagram
          albums={connectedAlbums}
          connections={connections}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   CHORD DIAGRAM
   Albums arranged by label around a circle, ribbons = shared musicians
   ═══════════════════════════════════════════════════════════════════════ */

function ChordDiagram({ albums, matrix, labelGroups, connections }) {
  const svgRef = useRef(null);
  const navigate = useNavigate();
  const [tip, setTip] = useState(null);
  const [legend, setLegend] = useState([]);

  useEffect(() => {
    if (!svgRef.current || albums.length === 0) return;

    const size = Math.min(window.innerWidth - 64, 960);
    const outerRadius = size / 2 - 120;
    const innerRadius = outerRadius - 20;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", size).attr("height", size);

    const g = svg.append("g").attr("transform", `translate(${size / 2},${size / 2})`);

    // D3 chord layout
    const chord = d3.chord()
      .padAngle(0.02)
      .sortSubgroups(d3.descending)
      .sortChords(d3.descending);

    const chords = chord(matrix);

    const arc = d3.arc().innerRadius(innerRadius).outerRadius(outerRadius);
    const ribbon = d3.ribbon().radius(innerRadius - 1);

    // Draw outer arcs (album segments)
    const group = g.append("g")
      .selectAll("g")
      .data(chords.groups)
      .join("g");

    group.append("path")
      .attr("d", arc)
      .attr("fill", (d) => labelColor(albums[d.index]?.label))
      .attr("fill-opacity", 0.85)
      .attr("stroke", "#000")
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("fill-opacity", 1);
        // Dim unrelated ribbons
        ribbons.attr("fill-opacity", (r) =>
          r.source.index === d.index || r.target.index === d.index ? 0.7 : 0.02
        );
        const a = albums[d.index];
        setTip({
          x: event.pageX, y: event.pageY,
          text: `${a.title}\n${a.artist} (${a.year})\n${a.label}`,
        });
      })
      .on("mouseout", function () {
        group.selectAll("path").attr("fill-opacity", 0.85);
        ribbons.attr("fill-opacity", 0.35);
        setTip(null);
      })
      .on("click", (e, d) => navigate(`/album/${albums[d.index].id}`));

    // Album labels on outer edge
    group.append("text")
      .each((d) => { d.angle = (d.startAngle + d.endAngle) / 2; })
      .attr("dy", "0.35em")
      .attr("transform", (d) =>
        `rotate(${(d.angle * 180 / Math.PI - 90)}) translate(${outerRadius + 8}) ${d.angle > Math.PI ? "rotate(180)" : ""}`
      )
      .attr("text-anchor", (d) => d.angle > Math.PI ? "end" : null)
      .text((d) => {
        const a = albums[d.index];
        const span = d.endAngle - d.startAngle;
        if (span < 0.012) return "";
        const max = span < 0.03 ? 8 : span < 0.06 ? 14 : 22;
        return a.title.length > max ? a.title.slice(0, max - 1) + "…" : a.title;
      })
      .attr("font-size", 6)
      .attr("font-family", "'JetBrains Mono', monospace")
      .attr("fill", "#555")
      .style("pointer-events", "none");

    // Draw ribbons (connections)
    const ribbons = g.append("g")
      .selectAll("path")
      .data(chords)
      .join("path")
      .attr("d", ribbon)
      .attr("fill", (d) => labelColor(albums[d.source.index]?.label))
      .attr("fill-opacity", 0.35)
      .attr("stroke", "none")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("fill-opacity", 0.85);
        const a1 = albums[d.source.index];
        const a2 = albums[d.target.index];
        const weight = matrix[d.source.index][d.target.index];
        // Find the actual shared musicians
        const musA = new Set(a1.lineup.map((m) => m.name));
        const shared = a2.lineup.filter((m) => musA.has(m.name));
        const names = shared.map((m) => m.name).join(", ");
        setTip({
          x: event.pageX, y: event.pageY,
          text: `${a1.title} ↔ ${a2.title}\n${Math.round(weight)} shared: ${names}`,
        });
      })
      .on("mouseout", function () {
        ribbons.attr("fill-opacity", 0.35);
        setTip(null);
      });

    // Build legend data (top labels by album count)
    const legendEntries = [...labelGroups.entries()]
      .filter(([, indices]) => indices.length >= 3)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 12)
      .map(([label, indices]) => ({ label, count: indices.length }));
    setLegend(legendEntries);
  }, [albums, matrix, labelGroups, navigate]);

  return (
    <div style={{ position: "relative" }}>
      <svg ref={svgRef} style={{ display: "block", margin: "0 auto", borderRadius: "var(--radius-md)", background: "var(--bg)" }} />
      {legend.length > 0 && (
        <div className="mono" style={{
          position: "absolute", top: 12, right: 12,
          display: "flex", flexDirection: "column", gap: 3,
          background: "rgba(0,0,0,0.5)", borderRadius: "var(--radius-sm)",
          padding: "8px 10px", backdropFilter: "blur(4px)",
        }}>
          {legend.map(({ label, count }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: labelColor(label), flexShrink: 0 }} />
              <span style={{ fontSize: 8, color: "var(--fg-muted)" }}>{label}</span>
              <span style={{ fontSize: 7, color: "var(--fg-ghost)", marginLeft: "auto" }}>{count}</span>
            </div>
          ))}
        </div>
      )}
      {tip && (
        <div className="mono" style={{
          position: "fixed", left: tip.x + 14, top: tip.y - 8,
          background: "var(--surface)", border: "1px solid var(--border-light)",
          borderRadius: 6, padding: "7px 11px", fontSize: 11,
          color: "var(--fg-dim)", whiteSpace: "pre-line", pointerEvents: "none", zIndex: 100,
        }}>
          {tip.text}
        </div>
      )}
      <p className="mono" style={{ textAlign: "center", fontSize: 10, color: "var(--fg-ghost)", marginTop: "var(--space-sm)" }}>
        Hover arcs for album info · Hover ribbons for shared musicians · Click arcs for album details
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ARC DIAGRAM
   Albums on a horizontal axis sorted by year, arcs above = shared musicians
   ═══════════════════════════════════════════════════════════════════════ */

function ArcDiagram({ albums, connections }) {
  const svgRef = useRef(null);
  const navigate = useNavigate();
  const [tip, setTip] = useState(null);

  // Sort albums by year for horizontal layout
  const sorted = useMemo(() =>
    [...albums].sort((a, b) => (a.year || 9999) - (b.year || 9999)),
    [albums]
  );

  // Remap connections to sorted indices
  const links = useMemo(() => {
    const idToIdx = new Map();
    sorted.forEach((a, i) => idToIdx.set(a.id, i));
    return connections
      .filter((c) => idToIdx.has(c.albumA.id) && idToIdx.has(c.albumB.id))
      .map((c) => ({
        source: idToIdx.get(c.albumA.id),
        target: idToIdx.get(c.albumB.id),
        weight: c.weight,
        shared: c.shared,
        albumA: c.albumA,
        albumB: c.albumB,
      }));
  }, [sorted, connections]);

  useEffect(() => {
    if (!svgRef.current || sorted.length === 0) return;

    const marginLeft = 40;
    const marginRight = 40;
    const width = Math.min(window.innerWidth - 64, 1200);
    const bottomMargin = 80; // room for year labels + help text
    const height = Math.min(window.innerHeight - 160, 700);
    const nodeY = height - bottomMargin;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const g = svg.append("g");

    // X positions: evenly space albums
    const xScale = d3.scaleLinear()
      .domain([0, sorted.length - 1])
      .range([marginLeft, width - marginRight]);

    // Year scale for axis
    const years = sorted.map((a) => a.year).filter(Boolean);
    const yearExtent = d3.extent(years);

    // Draw year axis
    const yearScale = d3.scaleLinear()
      .domain(yearExtent)
      .range([marginLeft, width - marginRight]);

    const axisTicks = d3.range(
      Math.ceil(yearExtent[0] / 5) * 5,
      yearExtent[1] + 1,
      5
    );

    g.append("line")
      .attr("x1", marginLeft)
      .attr("x2", width - marginRight)
      .attr("y1", nodeY)
      .attr("y2", nodeY)
      .attr("stroke", "#1a1a1e")
      .attr("stroke-width", 1);

    g.append("g")
      .selectAll("text")
      .data(axisTicks)
      .join("text")
      .attr("x", (d) => yearScale(d))
      .attr("y", nodeY + 24)
      .attr("text-anchor", "middle")
      .attr("font-size", 9)
      .attr("font-family", "'JetBrains Mono', monospace")
      .attr("fill", "#333")
      .text((d) => d);

    const maxWeight = d3.max(links, (d) => d.weight) || 1;

    // Draw arcs
    const arcPaths = g.append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("d", (d) => {
        const left = Math.min(xScale(d.source), xScale(d.target));
        const right = Math.max(xScale(d.source), xScale(d.target));
        const span = right - left;
        const arcHeight = Math.min(span * 0.4, nodeY - 10);
        return `M${left},${nodeY} A${span / 2},${arcHeight} 0 0,1 ${right},${nodeY}`;
      })
      .attr("fill", "none")
      .attr("stroke", (d) => labelColor(d.albumA.label))
      .attr("stroke-width", (d) => 0.5 + (d.weight / maxWeight) * 3)
      .attr("stroke-opacity", (d) => 0.08 + (d.weight / maxWeight) * 0.25)
      .on("mouseover", function (event, d) {
        d3.select(this).attr("stroke-opacity", 0.9).attr("stroke-width", 2 + (d.weight / maxWeight) * 3);
        // Highlight source and target nodes
        nodes.attr("fill-opacity", (n, i) => i === d.source || i === d.target ? 1 : 0.15);
        const names = d.shared.map((m) => m.name).join(", ");
        setTip({
          x: event.pageX, y: event.pageY,
          text: `${d.albumA.title} ↔ ${d.albumB.title}\n${d.weight} shared: ${names}`,
        });
      })
      .on("mouseout", function (event, d) {
        arcPaths.attr("stroke-opacity", (d) => 0.08 + (d.weight / maxWeight) * 0.25)
          .attr("stroke-width", (d) => 0.5 + (d.weight / maxWeight) * 3);
        nodes.attr("fill-opacity", 0.85);
        setTip(null);
      });

    // Draw nodes
    const nodes = g.append("g")
      .selectAll("circle")
      .data(sorted)
      .join("circle")
      .attr("cx", (d, i) => xScale(i))
      .attr("cy", nodeY)
      .attr("r", 4)
      .attr("fill", (d) => labelColor(d.label))
      .attr("fill-opacity", 0.85)
      .attr("stroke", "#000")
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .on("mouseover", function (event, d, idx) {
        const i = sorted.indexOf(d);
        d3.select(this).attr("r", 7).attr("fill-opacity", 1);
        // Highlight connected arcs
        arcPaths
          .attr("stroke-opacity", (l) => l.source === i || l.target === i ? 0.85 : 0.02)
          .attr("stroke-width", (l) =>
            l.source === i || l.target === i ? 2 + (l.weight / maxWeight) * 3 : 0.5 + (l.weight / maxWeight) * 3
          );
        // Highlight connected nodes
        const connIds = new Set();
        links.forEach((l) => {
          if (l.source === i) connIds.add(l.target);
          if (l.target === i) connIds.add(l.source);
        });
        nodes.attr("fill-opacity", (n, ni) => ni === i ? 1 : connIds.has(ni) ? 0.85 : 0.1);

        setTip({
          x: event.pageX, y: event.pageY,
          text: `${d.title}\n${d.artist} (${d.year})\n${d.label}`,
        });
      })
      .on("mouseout", function () {
        nodes.attr("r", 4).attr("fill-opacity", 0.85);
        arcPaths
          .attr("stroke-opacity", (d) => 0.08 + (d.weight / maxWeight) * 0.25)
          .attr("stroke-width", (d) => 0.5 + (d.weight / maxWeight) * 3);
        setTip(null);
      })
      .on("click", (e, d) => navigate(`/album/${d.id}`));

    // Album title labels below the axis (sparse to avoid overlap)
    const labelInterval = Math.max(1, Math.floor(sorted.length / 25));
    g.append("g")
      .selectAll("text")
      .data(sorted.filter((_, i) => i % labelInterval === 0))
      .join("text")
      .attr("x", (d) => xScale(sorted.indexOf(d)))
      .attr("y", nodeY + 42)
      .attr("text-anchor", "start")
      .attr("transform", (d) => `rotate(45, ${xScale(sorted.indexOf(d))}, ${nodeY + 42})`)
      .text((d) => d.title.length > 16 ? d.title.slice(0, 14) + "…" : d.title)
      .attr("font-size", 6)
      .attr("font-family", "'JetBrains Mono', monospace")
      .attr("fill", "#2a2a2e")
      .style("pointer-events", "none");

  }, [sorted, links, navigate]);

  return (
    <>
      <svg ref={svgRef} style={{ display: "block", margin: "0 auto", borderRadius: "var(--radius-md)", background: "var(--bg)" }} />
      {tip && (
        <div className="mono" style={{
          position: "fixed", left: tip.x + 14, top: tip.y - 8,
          background: "var(--surface)", border: "1px solid var(--border-light)",
          borderRadius: 6, padding: "7px 11px", fontSize: 11,
          color: "var(--fg-dim)", whiteSpace: "pre-line", pointerEvents: "none", zIndex: 100,
        }}>
          {tip.text}
        </div>
      )}
      <p className="mono" style={{ textAlign: "center", fontSize: 10, color: "var(--fg-ghost)", marginTop: "var(--space-sm)" }}>
        Albums sorted by year · Hover arcs for shared musicians · Hover nodes for album info · Click for details
      </p>
    </>
  );
}
