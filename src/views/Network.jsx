import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../App";
import { instrumentColor, labelColor, slugify } from "../data";
import * as d3 from "d3";

export default function Network() {
  const { albums, index } = useData();
  const navigate = useNavigate();
  const svgRef = useRef(null);
  const [dims, setDims] = useState({ w: 900, h: 560 });
  const [tip, setTip] = useState(null);
  const [instFilter, setInstFilter] = useState(null);

  useEffect(() => {
    setDims({
      w: Math.min(window.innerWidth - 64, 1400),
      h: Math.min(window.innerHeight - 200, 700),
    });
  }, []);

  useEffect(() => {
    if (!svgRef.current || !index) return;
    const { w, h } = dims;
    const { musicians } = index;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const tops = musicians.filter((m) => m.albums.length >= 2);
    const albumNodes = albums.map((a) => ({
      id: a.id,
      type: "album",
      data: a,
      r: 4 + Math.min(a.lineup.length * 1.2, 12),
    }));
    const musicianNodes = tops
      .filter((m) => m.albums.some((ma) => albums.find((a) => a.id === ma.id)))
      .map((m) => ({
        id: "m_" + m.name,
        type: "musician",
        data: m,
        r: 3 + Math.min(m.albums.length * 1.5, 14),
      }));

    const nodeMap = new Map();
    [...albumNodes, ...musicianNodes].forEach((n) => nodeMap.set(n.id, n));

    const links = [];
    for (const a of albums) {
      for (const m of a.lineup) {
        if (nodeMap.has("m_" + m.name)) {
          links.push({ source: a.id, target: "m_" + m.name, inst: m.instrument });
        }
      }
    }

    const nodes = [...nodeMap.values()];

    // Defs
    const defs = svg.append("defs");
    const glow = defs.append("filter").attr("id", "netglow");
    glow.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "blur");
    const merge = glow.append("feMerge");
    merge.append("feMergeNode").attr("in", "blur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");

    const g = svg.append("g");
    svg.call(d3.zoom().scaleExtent([0.2, 5]).on("zoom", (e) => g.attr("transform", e.transform)));

    const link = g.append("g").selectAll("line").data(links).join("line")
      .attr("stroke", (d) => instFilter ? (d.inst === instFilter ? instrumentColor(d.inst) : "#111") : "#1a1a1e")
      .attr("stroke-width", 0.5)
      .attr("stroke-opacity", (d) => instFilter ? (d.inst === instFilter ? 0.6 : 0.05) : 0.3);

    const node = g.append("g").selectAll("circle").data(nodes).join("circle")
      .attr("r", (d) => d.r)
      .attr("fill", (d) => d.type === "musician" ? instrumentColor(d.data.primary) : labelColor(d.data.label))
      .attr("fill-opacity", (d) => d.type === "album" ? 0.85 : 0.3)
      .attr("stroke", (d) => d.type === "musician" ? instrumentColor(d.data.primary) : "none")
      .attr("stroke-width", (d) => d.type === "musician" ? 1.5 : 0)
      .attr("stroke-opacity", 0.5)
      .attr("filter", (d) => d.r > 10 ? "url(#netglow)" : null)
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("fill-opacity", 1).attr("stroke-opacity", 1);
        const conn = new Set();
        links.forEach((l) => {
          const s = typeof l.source === "object" ? l.source.id : l.source;
          const t = typeof l.target === "object" ? l.target.id : l.target;
          if (s === d.id) conn.add(t);
          if (t === d.id) conn.add(s);
        });
        node.attr("fill-opacity", (n) => n.id === d.id ? 1 : conn.has(n.id) ? 0.8 : 0.04);
        link.attr("stroke-opacity", (l) => {
          const s = typeof l.source === "object" ? l.source.id : l.source;
          const t = typeof l.target === "object" ? l.target.id : l.target;
          return s === d.id || t === d.id ? 0.8 : 0.02;
        }).attr("stroke", (l) => {
          const s = typeof l.source === "object" ? l.source.id : l.source;
          const t = typeof l.target === "object" ? l.target.id : l.target;
          return s === d.id || t === d.id ? instrumentColor(l.inst) : "#1a1a1e";
        });
        const text = d.type === "album"
          ? `${d.data.title} (${d.data.year || "?"})\n${d.data.artist} · ${d.data.label || "?"}`
          : `${d.data.name}\n${d.data.instruments.join(", ")}\n${d.data.albums.length} albums`;
        setTip({ x: event.pageX, y: event.pageY, text });
      })
      .on("mouseout", function () {
        node.attr("fill-opacity", (d) => d.type === "album" ? 0.85 : 0.3).attr("stroke-opacity", 0.5);
        link.attr("stroke-opacity", (d) => instFilter ? (d.inst === instFilter ? 0.6 : 0.05) : 0.3)
          .attr("stroke", (d) => instFilter ? (d.inst === instFilter ? instrumentColor(d.inst) : "#111") : "#1a1a1e");
        setTip(null);
      })
      .on("click", (e, d) => {
        if (d.type === "album") navigate(`/album/${d.data.id}`);
        else navigate(`/artist/${d.data.slug}`);
      });

    // Labels for large nodes
    g.append("g").selectAll("text").data(nodes.filter((n) => n.r > 10)).join("text")
      .text((d) => d.type === "album" ? d.data.title : d.data.name)
      .attr("font-size", 7.5)
      .attr("font-family", "'JetBrains Mono', monospace")
      .attr("fill", "#555")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => d.r + 10)
      .style("pointer-events", "none");

    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance(36).strength(0.2))
      .force("charge", d3.forceManyBody().strength((d) => d.type === "album" ? -60 : -25))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .force("collision", d3.forceCollide().radius((d) => d.r + 2))
      .force("x", d3.forceX(w / 2).strength(0.04))
      .force("y", d3.forceY(h / 2).strength(0.04))
      .on("tick", () => {
        link.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
        node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
        g.selectAll("text").attr("x", (d) => d.x).attr("y", (d) => d.y);
      });

    node.call(
      d3.drag()
        .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on("end", (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }),
    );

    return () => sim.stop();
  }, [albums, index, dims, instFilter, navigate]);

  const usedInstruments = useMemo(() => {
    const s = new Set();
    albums.forEach((a) => a.lineup.forEach((m) => s.add(m.instrument)));
    return [...s].sort();
  }, [albums]);

  return (
    <div style={{ padding: "var(--space-md) var(--space-xl)" }}>
      {/* Legend */}
      <div className="mono" style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 10, color: "var(--fg-muted)", marginBottom: "var(--space-sm)" }}>
        {usedInstruments.map((inst) => (
          <span
            key={inst}
            style={{
              cursor: "pointer",
              opacity: instFilter && instFilter !== inst ? 0.2 : 1,
              transition: "opacity 0.2s",
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
            onClick={() => setInstFilter(instFilter === inst ? null : inst)}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: instrumentColor(inst), display: "inline-block" }} />
            {inst}
          </span>
        ))}
      </div>

      <svg ref={svgRef} width={dims.w} height={dims.h} style={{ display: "block", borderRadius: "var(--radius-md)", background: "#0c0c0e" }} />

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
        Drag nodes · Scroll to zoom · Click to view details · Click legend to filter
      </p>
    </div>
  );
}
