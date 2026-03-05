import { useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../App";
import { instrumentFamily, familyColor } from "../data";
import * as d3 from "d3";

export default function ArtistsCareers() {
  const { index } = useData();
  const svgRef = useRef(null);
  const navigate = useNavigate();

  const artists = useMemo(() => {
    if (!index) return [];
    return index.musicians
      .filter((m) => m.albums.length >= 3) // only artists with 3+ albums
      .map((m) => {
        const years = m.albums.map((a) => a.year).filter(Boolean);
        if (years.length === 0) return null;
        return {
          name: m.name,
          slug: m.slug,
          primary: m.primary,
          family: instrumentFamily(m.primary),
          start: Math.min(...years),
          end: Math.max(...years),
          count: m.albums.length,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.start - b.start || b.count - a.count)
      .slice(0, 80);
  }, [index]);

  useEffect(() => {
    if (artists.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 30, right: 20, bottom: 40, left: 160 };
    const barHeight = 14;
    const barGap = 3;
    const width = 900;
    const height = margin.top + margin.bottom + artists.length * (barHeight + barGap);

    svg.attr("width", width).attr("height", height);

    const yearMin = d3.min(artists, (d) => d.start);
    const yearMax = d3.max(artists, (d) => d.end);

    const x = d3.scaleLinear()
      .domain([yearMin, yearMax])
      .range([margin.left, width - margin.right]);

    const g = svg.append("g");

    // Year axis
    const xAxis = d3.axisBottom(x).tickFormat(d3.format("d")).ticks(10);
    g.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(xAxis)
      .call((g) => g.selectAll("text").attr("fill", "var(--fg-ghost)").attr("font-family", "var(--font-mono)").attr("font-size", 9))
      .call((g) => g.selectAll("line").attr("stroke", "var(--border)"))
      .call((g) => g.select(".domain").attr("stroke", "var(--border)"));

    // Grid lines
    g.append("g")
      .selectAll("line")
      .data(x.ticks(10))
      .join("line")
      .attr("x1", (d) => x(d))
      .attr("x2", (d) => x(d))
      .attr("y1", margin.top)
      .attr("y2", height - margin.bottom)
      .attr("stroke", "var(--border)")
      .attr("stroke-dasharray", "2,4");

    // Bars
    const bars = g.selectAll("g.bar")
      .data(artists)
      .join("g")
      .attr("class", "bar")
      .attr("transform", (d, i) => `translate(0,${margin.top + i * (barHeight + barGap)})`)
      .attr("cursor", "pointer")
      .on("click", (event, d) => navigate(`/artist/${d.slug}`));

    bars.append("rect")
      .attr("x", (d) => x(d.start))
      .attr("width", (d) => Math.max(3, x(d.end) - x(d.start)))
      .attr("height", barHeight)
      .attr("rx", 2)
      .attr("fill", (d) => familyColor(d.family))
      .attr("opacity", 0.7)
      .on("mouseenter", function () { d3.select(this).attr("opacity", 1); })
      .on("mouseleave", function () { d3.select(this).attr("opacity", 0.7); });

    // Artist name labels
    bars.append("text")
      .attr("x", margin.left - 8)
      .attr("y", barHeight / 2)
      .attr("text-anchor", "end")
      .attr("dy", "0.35em")
      .attr("fill", "var(--fg-dim)")
      .attr("font-family", "var(--font-mono)")
      .attr("font-size", 9)
      .text((d) => d.name);

    // Album count label
    bars.append("text")
      .attr("x", (d) => Math.max(x(d.start) + 4, x(d.end) + 6))
      .attr("y", barHeight / 2)
      .attr("dy", "0.35em")
      .attr("fill", "var(--fg-ghost)")
      .attr("font-family", "var(--font-mono)")
      .attr("font-size", 8)
      .text((d) => `${d.count}`);

  }, [artists, navigate]);

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)", overflowX: "auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>Careers</h1>
      <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}>
        Career spans of the most prolific artists (3+ albums)
      </p>
      <svg ref={svgRef} />
    </div>
  );
}
