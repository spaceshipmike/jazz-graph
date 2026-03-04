import { useMemo, useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../App";
import { instrumentFamily } from "../data";
import * as d3 from "d3";

const FAMILIES = ["brass", "reeds", "keys", "rhythm", "strings", "mallets", "vocals"];
const FAMILY_COLORS = {
  brass: "#e85d3a",
  reeds: "#d4a843",
  keys: "#5b9bd5",
  rhythm: "#7c5cbf",
  strings: "#c75d8f",
  mallets: "#6bb5a0",
  vocals: "#d48db0",
};
const FAMILY_FILTER = {
  brass: "trumpet",
  reeds: "tenor sax",
  keys: "piano",
  rhythm: "bass",
  strings: "guitar",
  mallets: "vibraphone",
  vocals: "vocals",
};

export default function Eras() {
  const { albums } = useData();
  const navigate = useNavigate();
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 900, h: 500 });
  const [hover, setHover] = useState(null); // { family, year, count, x, y }

  // Aggregate data: per-year instrument family counts
  const { stackData, years } = useMemo(() => {
    const yearMap = new Map();
    for (const album of albums) {
      const y = album.year;
      if (!y) continue;
      if (!yearMap.has(y)) yearMap.set(y, {});
      const fams = yearMap.get(y);
      const seen = new Set();
      for (const m of album.lineup) {
        const f = instrumentFamily(m.instrument);
        if (f === "other" || seen.has(f)) continue;
        seen.add(f);
        fams[f] = (fams[f] || 0) + 1;
      }
    }
    const yrs = [...yearMap.keys()].sort((a, b) => a - b);
    const data = yrs.map((y) => {
      const row = { year: y };
      for (const f of FAMILIES) row[f] = yearMap.get(y)?.[f] || 0;
      return row;
    });
    return { stackData: data, years: yrs };
  }, [albums]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width } = entry.contentRect;
      setDims({ w: width, h: Math.min(500, Math.max(320, width * 0.45)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // D3 render
  useEffect(() => {
    if (!stackData.length || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 40, left: 20 };
    const w = dims.w - margin.left - margin.right;
    const h = dims.h - margin.top - margin.bottom;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain(d3.extent(years)).range([0, w]);
    const stack = d3.stack()
      .keys(FAMILIES)
      .offset(d3.stackOffsetWiggle)
      .order(d3.stackOrderInsideOut);
    const series = stack(stackData);

    const y = d3.scaleLinear()
      .domain([d3.min(series, (s) => d3.min(s, (d) => d[0])), d3.max(series, (s) => d3.max(s, (d) => d[1]))])
      .range([h, 0]);

    const area = d3.area()
      .x((d) => x(d.data.year))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(d3.curveBasis);

    // Draw streams
    g.selectAll("path")
      .data(series)
      .join("path")
      .attr("d", area)
      .attr("fill", (d) => FAMILY_COLORS[d.key])
      .attr("opacity", (d) => (hover ? (hover.family === d.key ? 1 : 0.15) : 0.85))
      .style("cursor", "pointer")
      .on("mousemove", function (event, d) {
        const [mx] = d3.pointer(event, g.node());
        const yearVal = Math.round(x.invert(mx));
        const row = stackData.find((r) => r.year === yearVal);
        const count = row ? row[d.key] : 0;
        setHover({
          family: d.key,
          year: yearVal,
          count,
          x: event.clientX,
          y: event.clientY,
        });
      })
      .on("mouseleave", () => setHover(null))
      .on("click", (event, d) => {
        const inst = FAMILY_FILTER[d.key];
        if (inst) navigate(`/?inst=${encodeURIComponent(inst)}`);
      });

    // X-axis
    const tickYears = years.filter((y) => y % 5 === 0);
    g.append("g")
      .attr("transform", `translate(0,${h + 4})`)
      .call(d3.axisBottom(x).tickValues(tickYears).tickFormat(d3.format("d")).tickSize(0))
      .call((g) => g.select(".domain").remove())
      .selectAll("text")
      .attr("fill", "#555")
      .attr("font-family", "var(--font-mono)")
      .attr("font-size", 10);

  }, [stackData, years, dims, hover, navigate]);

  return (
    <div style={{ padding: "var(--space-xl)", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, marginBottom: 4 }}>
          Instrument Eras
        </h2>
        <p className="mono" style={{ color: "var(--fg-muted)", fontSize: 11 }}>
          How instrument families rise and fall across the jazz timeline. Click a stream to filter the gallery.
        </p>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: "var(--space-md)" }}>
        {FAMILIES.map((f) => (
          <span key={f} className="mono" style={{ fontSize: 10, color: "var(--fg-dim)", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: FAMILY_COLORS[f], display: "inline-block" }} />
            {f}
          </span>
        ))}
      </div>

      <div ref={containerRef} style={{ width: "100%", position: "relative" }}>
        <svg ref={svgRef} width={dims.w} height={dims.h} />

        {hover && (
          <div
            className="mono"
            style={{
              position: "fixed",
              left: hover.x + 12,
              top: hover.y - 40,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "6px 10px",
              fontSize: 11,
              color: "var(--fg)",
              pointerEvents: "none",
              zIndex: 10,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: FAMILY_COLORS[hover.family], fontWeight: 600 }}>{hover.family}</span>
            {" "}&middot; {hover.year} &middot; {hover.count} album{hover.count !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
