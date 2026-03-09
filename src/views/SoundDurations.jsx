import { useMemo, useRef, useEffect } from "react";
import { useData } from "../App";
import * as d3 from "d3";

export default function SoundDurations() {
  const { albums } = useData();
  const svgRef = useRef(null);

  const durations = useMemo(() => {
    const mins = [];
    for (const a of albums) {
      for (const t of a.tracks || []) {
        if (t.lengthMs) mins.push(t.lengthMs / 60000); // to minutes
      }
    }
    return mins;
  }, [albums]);

  useEffect(() => {
    if (durations.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 50, left: 50 };
    const width = 800;
    const height = 380;

    svg.attr("width", width).attr("height", height);

    // Cap at 20 minutes for readability
    const capped = durations.filter((d) => d <= 20);

    const x = d3.scaleLinear()
      .domain([0, 20])
      .range([margin.left, width - margin.right]);

    const bins = d3.bin()
      .domain(x.domain())
      .thresholds(40)(capped);

    const y = d3.scaleLinear()
      .domain([0, d3.max(bins, (d) => d.length)])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const g = svg.append("g");

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(10).tickFormat((d) => `${d}m`))
      .call((g) => g.selectAll("text").attr("fill", "var(--fg-ghost)").attr("font-family", "var(--font-mono)").attr("font-size", 9))
      .call((g) => g.selectAll("line").attr("stroke", "var(--border)"))
      .call((g) => g.select(".domain").attr("stroke", "var(--border)"));

    // Y axis
    g.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(6))
      .call((g) => g.selectAll("text").attr("fill", "var(--fg-ghost)").attr("font-family", "var(--font-mono)").attr("font-size", 9))
      .call((g) => g.selectAll("line").attr("stroke", "var(--border)"))
      .call((g) => g.select(".domain").remove());

    // Bars
    g.selectAll("rect")
      .data(bins)
      .join("rect")
      .attr("x", (d) => x(d.x0) + 1)
      .attr("width", (d) => Math.max(0, x(d.x1) - x(d.x0) - 1))
      .attr("y", (d) => y(d.length))
      .attr("height", (d) => y(0) - y(d.length))
      .attr("fill", "#d4a843")
      .attr("opacity", 0.65)
      .attr("rx", 1);

    // Stats annotation
    const median = d3.median(durations);
    const mean = d3.mean(durations);

    // Median line
    g.append("line")
      .attr("x1", x(Math.min(median, 20)))
      .attr("x2", x(Math.min(median, 20)))
      .attr("y1", margin.top)
      .attr("y2", height - margin.bottom)
      .attr("stroke", "var(--fg)")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,4");

    g.append("text")
      .attr("x", x(Math.min(median, 20)) + 6)
      .attr("y", margin.top + 12)
      .attr("fill", "var(--fg)")
      .attr("font-family", "var(--font-mono)")
      .attr("font-size", 9)
      .text(`median: ${median.toFixed(1)}m`);

  }, [durations]);

  const trackCount = durations.length;
  const albumsWithTracks = albums.filter((a) => a.tracks && a.tracks.length > 0).length;

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)", overflowX: "auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 4 }}>Track Durations</h1>
      <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}>
        {trackCount.toLocaleString()} tracks from {albumsWithTracks} albums (capped at 20 min)
      </p>
      {trackCount === 0 ? (
        <p className="mono" style={{ color: "var(--fg-muted)", textAlign: "center", padding: 60 }}>
          No track data yet — run npm run fetch-tracks
        </p>
      ) : (
        <svg ref={svgRef} />
      )}
    </div>
  );
}
