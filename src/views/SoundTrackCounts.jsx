import { useMemo, useRef, useEffect } from "react";
import { useData } from "../App";
import * as d3 from "d3";

export default function SoundTrackCounts() {
  const { albums } = useData();
  const svgRef = useRef(null);

  const counts = useMemo(() => {
    return albums
      .filter((a) => a.tracks && a.tracks.length > 0)
      .map((a) => a.tracks.length);
  }, [albums]);

  useEffect(() => {
    if (counts.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 50, left: 50 };
    const width = 700;
    const height = 350;

    svg.attr("width", width).attr("height", height);

    const maxCount = Math.min(d3.max(counts), 25); // cap at 25 tracks

    const x = d3.scaleLinear()
      .domain([0, maxCount])
      .range([margin.left, width - margin.right]);

    const bins = d3.bin()
      .domain([0, maxCount])
      .thresholds(maxCount)(counts.filter((c) => c <= maxCount));

    const y = d3.scaleLinear()
      .domain([0, d3.max(bins, (d) => d.length)])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const g = svg.append("g");

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(maxCount).tickFormat(d3.format("d")))
      .call((g) => g.selectAll("text").attr("fill", "var(--fg-ghost)").attr("font-family", "var(--font-mono)").attr("font-size", 9))
      .call((g) => g.selectAll("line").attr("stroke", "var(--border)"))
      .call((g) => g.select(".domain").attr("stroke", "var(--border)"));

    g.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(6))
      .call((g) => g.selectAll("text").attr("fill", "var(--fg-ghost)").attr("font-family", "var(--font-mono)").attr("font-size", 9))
      .call((g) => g.selectAll("line").attr("stroke", "var(--border)"))
      .call((g) => g.select(".domain").remove());

    // X label
    g.append("text")
      .attr("x", (margin.left + width - margin.right) / 2)
      .attr("y", height - 6)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--fg-ghost)")
      .attr("font-family", "var(--font-mono)")
      .attr("font-size", 9)
      .text("tracks per album");

    // Bars
    g.selectAll("rect")
      .data(bins)
      .join("rect")
      .attr("x", (d) => x(d.x0) + 1)
      .attr("width", (d) => Math.max(0, x(d.x1) - x(d.x0) - 2))
      .attr("y", (d) => y(d.length))
      .attr("height", (d) => y(0) - y(d.length))
      .attr("fill", "#6bb5a0")
      .attr("opacity", 0.65)
      .attr("rx", 1);

    // Median line
    const median = d3.median(counts);
    if (median <= maxCount) {
      g.append("line")
        .attr("x1", x(median))
        .attr("x2", x(median))
        .attr("y1", margin.top)
        .attr("y2", height - margin.bottom)
        .attr("stroke", "var(--fg)")
        .attr("stroke-dasharray", "4,4");

      g.append("text")
        .attr("x", x(median) + 6)
        .attr("y", margin.top + 12)
        .attr("fill", "var(--fg)")
        .attr("font-family", "var(--font-mono)")
        .attr("font-size", 9)
        .text(`median: ${median}`);
    }

  }, [counts]);

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)", overflowX: "auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>Track Counts</h1>
      <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}>
        How many tracks per album ({counts.length} albums with track data)
      </p>
      {counts.length === 0 ? (
        <p className="mono" style={{ color: "var(--fg-muted)", textAlign: "center", padding: 60 }}>
          No track data yet — run npm run fetch-tracks
        </p>
      ) : (
        <svg ref={svgRef} />
      )}
    </div>
  );
}
