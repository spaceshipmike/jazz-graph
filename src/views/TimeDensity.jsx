import { useMemo, useRef, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../App";
import { labelColor } from "../data";
import { SubgenreBadge } from "../components/SubgenreIcon";
import { PlayableAlbumArt } from "../components/SpotifyUI";
import { useSpotify } from "../spotify";
import * as d3 from "d3";

// Alternate decade tints so eras read at a glance.
const DECADE_TINT = ["var(--fg-dim)", "#8a8578"];

export default function TimeDensity() {
  const { albums } = useData();
  const svgRef = useRef(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [tip, setTip] = useState(null);

  const yearCounts = useMemo(() => {
    const counts = new Map();
    for (const a of albums) {
      if (!a.year) continue;
      counts.set(a.year, (counts.get(a.year) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0] - b[0]);
  }, [albums]);

  useEffect(() => {
    if (yearCounts.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const width = 900;
    const height = 400;

    svg.attr("width", width).attr("height", height);

    const x = d3.scaleBand()
      .domain(yearCounts.map((d) => d[0]))
      .range([margin.left, width - margin.right])
      .padding(0.15);

    const y = d3.scaleLinear()
      .domain([0, d3.max(yearCounts, (d) => d[1])])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const g = svg.append("g");

    // Y axis
    g.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(6))
      .call((g) => g.selectAll("text").attr("fill", "var(--fg-ghost)").attr("font-family", "var(--font-mono)").attr("font-size", 9))
      .call((g) => g.selectAll("line").attr("stroke", "var(--border)"))
      .call((g) => g.select(".domain").remove());

    // Grid
    g.append("g")
      .selectAll("line")
      .data(y.ticks(6))
      .join("line")
      .attr("x1", margin.left)
      .attr("x2", width - margin.right)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d))
      .attr("stroke", "var(--border)")
      .attr("stroke-dasharray", "2,4");

    // X axis (show every 5th year)
    const xAxis = d3.axisBottom(x)
      .tickValues(yearCounts.map((d) => d[0]).filter((y) => y % 5 === 0));
    g.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(xAxis)
      .call((g) => g.selectAll("text").attr("fill", "var(--fg-ghost)").attr("font-family", "var(--font-mono)").attr("font-size", 9))
      .call((g) => g.selectAll("line").attr("stroke", "var(--border)"))
      .call((g) => g.select(".domain").attr("stroke", "var(--border)"));

    // Bars
    g.selectAll("rect")
      .data(yearCounts)
      .join("rect")
      .attr("x", (d) => x(d[0]))
      .attr("width", x.bandwidth())
      .attr("y", (d) => y(d[1]))
      .attr("height", (d) => y(0) - y(d[1]))
      .attr("fill", (d) => (d[0] === selectedYear ? "var(--fg)" : DECADE_TINT[Math.floor(d[0] / 10) % 2]))
      .attr("rx", 1)
      .attr("opacity", (d) => (d[0] === selectedYear ? 1 : 0.6))
      .style("cursor", "pointer")
      .on("mouseenter", function (event, d) {
        d3.select(this).attr("opacity", 1);
        const rect = svgRef.current.getBoundingClientRect();
        setTip({
          x: rect.left + x(d[0]) + x.bandwidth() / 2,
          y: rect.top + y(d[1]),
          year: d[0],
          count: d[1],
        });
      })
      .on("mouseleave", function (event, d) {
        d3.select(this).attr("opacity", d[0] === selectedYear ? 1 : 0.6);
        setTip(null);
      })
      .on("click", (event, d) => {
        setSelectedYear((cur) => (cur === d[0] ? null : d[0]));
      });

  }, [yearCounts, selectedYear]);

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)", overflowX: "auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 4 }}>Recording Density</h1>
      <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}>
        Albums per year across the collection — click a year to see its albums
      </p>
      <svg ref={svgRef} />

      {tip && (
        <div
          className="mono"
          style={{
            position: "fixed",
            left: tip.x,
            top: tip.y - 34,
            transform: "translateX(-50%)",
            background: "var(--surface)",
            border: "1px solid var(--border-light)",
            borderRadius: 6,
            padding: "4px 9px",
            fontSize: 10,
            color: "var(--fg-dim)",
            pointerEvents: "none",
            zIndex: 100,
            whiteSpace: "nowrap",
          }}
        >
          {tip.year} · {tip.count} album{tip.count !== 1 ? "s" : ""}
        </div>
      )}

      {selectedYear && <YearPanel albums={albums} year={selectedYear} onClose={() => setSelectedYear(null)} />}
    </div>
  );
}

/** Drill-down: everything the collection holds for one year. */
function YearPanel({ albums, year, onClose }) {
  const { isLoggedIn } = useSpotify();

  const { yearAlbums, topLabels, subgenres } = useMemo(() => {
    const yearAlbums = albums
      .filter((a) => a.year === year)
      .sort((a, b) => a.artist.localeCompare(b.artist));

    const labelCounts = new Map();
    for (const a of yearAlbums) {
      if (a.label) labelCounts.set(a.label, (labelCounts.get(a.label) || 0) + 1);
    }
    const topLabels = [...labelCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    const subgenres = [...new Set(yearAlbums.flatMap((a) => a.subgenres || []))].sort();

    return { yearAlbums, topLabels, subgenres };
  }, [albums, year]);

  return (
    <div
      style={{
        marginTop: "var(--space-lg)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-lg)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: "var(--space-md)" }}>
        <h2 style={{ fontSize: 24, fontWeight: 300 }}>
          {year} <span className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)" }}>· {yearAlbums.length} albums</span>
        </h2>
        <div style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
          <Link to={`/time?year=${year}`} className="mono" style={{ fontSize: 10, color: "var(--fg-muted)", letterSpacing: "0.05em" }}>
            View in Timeline →
          </Link>
          <button onClick={onClose} className="mono" style={{ fontSize: 10, color: "var(--fg-ghost)", cursor: "pointer" }}>
            ✕ close
          </button>
        </div>
      </div>

      {/* Label + subgenre context for the year */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 6px", marginBottom: "var(--space-md)" }}>
        {topLabels.map(([label, count]) => (
          <Link
            key={label}
            to={`/labels/browse?label=${encodeURIComponent(label)}`}
            className="pill mono"
            style={{
              fontSize: 9,
              background: "transparent",
              border: `1px solid ${labelColor(label)}55`,
              color: labelColor(label),
              textDecoration: "none",
            }}
          >
            {label} <span style={{ opacity: 0.6 }}>({count})</span>
          </Link>
        ))}
      </div>
      {subgenres.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: "var(--space-lg)" }}>
          {subgenres.map((sg) => <SubgenreBadge key={sg} name={sg} />)}
        </div>
      )}

      {/* Album covers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: "var(--space-sm)" }}>
        {yearAlbums.map((a) => (
          <div key={a.id} style={{ textAlign: "center" }}>
            <div style={{ borderRadius: "var(--radius-sm)", overflow: "hidden", background: "var(--bg)", aspectRatio: "1" }}>
              {a.coverPath ? (
                isLoggedIn ? (
                  <PlayableAlbumArt album={a}>
                    <img src={`/data/${a.coverPath}`} alt={a.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </PlayableAlbumArt>
                ) : (
                  <Link to={`/album/${a.id}`}>
                    <img src={`/data/${a.coverPath}`} alt={a.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </Link>
                )
              ) : (
                <Link to={`/album/${a.id}`} style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="mono" style={{ fontSize: 8, color: "var(--fg-ghost)" }}>?</span>
                </Link>
              )}
            </div>
            <Link to={`/album/${a.id}`} style={{ display: "block", fontSize: 9.5, marginTop: 3, lineHeight: 1.25, color: "var(--fg-dim)" }}>
              {a.title.length > 22 ? a.title.slice(0, 20) + "…" : a.title}
            </Link>
            <div className="mono" style={{ fontSize: 8.5, color: "var(--fg-muted)" }}>{a.artist}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
