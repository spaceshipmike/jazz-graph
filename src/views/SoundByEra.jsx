import { useMemo, useRef, useEffect } from "react";
import { useData } from "../App";
import * as d3 from "d3";

export default function SoundByEra() {
  const { albums } = useData();
  const svgRef = useRef(null);

  const decadeData = useMemo(() => {
    const byDecade = new Map();
    for (const a of albums) {
      if (!a.year || !a.tracks) continue;
      const decade = Math.floor(a.year / 10) * 10;
      if (!byDecade.has(decade)) byDecade.set(decade, []);
      for (const t of a.tracks) {
        if (t.lengthMs) byDecade.get(decade).push(t.lengthMs / 60000);
      }
    }
    return [...byDecade.entries()]
      .sort((a, b) => a[0] - b[0])
      .filter(([, durations]) => durations.length >= 5)
      .map(([decade, durations]) => ({
        decade,
        avg: d3.mean(durations),
        median: d3.median(durations),
        count: durations.length,
      }));
  }, [albums]);

  useEffect(() => {
    if (decadeData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 50, left: 50 };
    const width = 700;
    const height = 350;

    svg.attr("width", width).attr("height", height);

    const x = d3.scaleBand()
      .domain(decadeData.map((d) => d.decade))
      .range([margin.left, width - margin.right])
      .padding(0.3);

    const y = d3.scaleLinear()
      .domain([0, d3.max(decadeData, (d) => d.avg) * 1.2])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const g = svg.append("g");

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickFormat((d) => `${d}s`))
      .call((g) => g.selectAll("text").attr("fill", "var(--fg-ghost)").attr("font-family", "var(--font-mono)").attr("font-size", 9))
      .call((g) => g.selectAll("line").attr("stroke", "var(--border)"))
      .call((g) => g.select(".domain").attr("stroke", "var(--border)"));

    g.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(6).tickFormat((d) => `${d.toFixed(0)}m`))
      .call((g) => g.selectAll("text").attr("fill", "var(--fg-ghost)").attr("font-family", "var(--font-mono)").attr("font-size", 9))
      .call((g) => g.selectAll("line").attr("stroke", "var(--border)"))
      .call((g) => g.select(".domain").remove());

    // Bars (average)
    g.selectAll("rect")
      .data(decadeData)
      .join("rect")
      .attr("x", (d) => x(d.decade))
      .attr("width", x.bandwidth())
      .attr("y", (d) => y(d.avg))
      .attr("height", (d) => y(0) - y(d.avg))
      .attr("fill", "#e85d3a")
      .attr("opacity", 0.6)
      .attr("rx", 2);

    // Median dots
    g.selectAll("circle")
      .data(decadeData)
      .join("circle")
      .attr("cx", (d) => x(d.decade) + x.bandwidth() / 2)
      .attr("cy", (d) => y(d.median))
      .attr("r", 4)
      .attr("fill", "var(--fg)")
      .attr("opacity", 0.8);

    // Value labels
    g.selectAll("text.val")
      .data(decadeData)
      .join("text")
      .attr("class", "val")
      .attr("x", (d) => x(d.decade) + x.bandwidth() / 2)
      .attr("y", (d) => y(d.avg) - 8)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--fg-dim)")
      .attr("font-family", "var(--font-mono)")
      .attr("font-size", 9)
      .text((d) => `${d.avg.toFixed(1)}m`);

  }, [decadeData]);

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)", overflowX: "auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>Duration by Era</h1>
      <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}>
        Average track length by decade (bar: mean, dot: median)
      </p>
      {decadeData.length === 0 ? (
        <p className="mono" style={{ color: "var(--fg-muted)", textAlign: "center", padding: 60 }}>
          No track data yet — run npm run fetch-tracks
        </p>
      ) : (
        <svg ref={svgRef} />
      )}
    </div>
  );
}
