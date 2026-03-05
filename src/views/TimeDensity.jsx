import { useMemo, useRef, useEffect } from "react";
import { useData } from "../App";
import * as d3 from "d3";

export default function TimeDensity() {
  const { albums } = useData();
  const svgRef = useRef(null);

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
      .attr("fill", "var(--fg-dim)")
      .attr("rx", 1)
      .attr("opacity", 0.6)
      .on("mouseenter", function () { d3.select(this).attr("opacity", 1); })
      .on("mouseleave", function () { d3.select(this).attr("opacity", 0.6); });

  }, [yearCounts]);

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)", overflowX: "auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>Recording Density</h1>
      <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}>
        Albums per year across the collection
      </p>
      <svg ref={svgRef} />
    </div>
  );
}
