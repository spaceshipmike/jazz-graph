import { useMemo, useRef, useEffect } from "react";
import { useData } from "../App";
import * as d3 from "d3";

export default function TimeEnsembles() {
  const { albums } = useData();
  const svgRef = useRef(null);

  const decadeData = useMemo(() => {
    const byDecade = new Map();
    for (const a of albums) {
      if (!a.year) continue;
      const decade = Math.floor(a.year / 10) * 10;
      if (!byDecade.has(decade)) byDecade.set(decade, []);
      byDecade.get(decade).push(a.lineup.length);
    }
    return [...byDecade.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([decade, sizes]) => ({
        decade,
        avg: d3.mean(sizes),
        median: d3.median(sizes),
        min: d3.min(sizes),
        max: d3.max(sizes),
        q1: d3.quantile(sizes.sort(d3.ascending), 0.25),
        q3: d3.quantile(sizes.sort(d3.ascending), 0.75),
        count: sizes.length,
      }));
  }, [albums]);

  useEffect(() => {
    if (decadeData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const width = 700;
    const height = 350;

    svg.attr("width", width).attr("height", height);

    const x = d3.scaleBand()
      .domain(decadeData.map((d) => d.decade))
      .range([margin.left, width - margin.right])
      .padding(0.3);

    const y = d3.scaleLinear()
      .domain([0, d3.max(decadeData, (d) => d.q3 + 2)])
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

    // Y label
    g.append("text")
      .attr("transform", `translate(14,${height / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--fg-ghost)")
      .attr("font-family", "var(--font-mono)")
      .attr("font-size", 9)
      .text("musicians per album");

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickFormat((d) => `${d}s`))
      .call((g) => g.selectAll("text").attr("fill", "var(--fg-ghost)").attr("font-family", "var(--font-mono)").attr("font-size", 9))
      .call((g) => g.selectAll("line").attr("stroke", "var(--border)"))
      .call((g) => g.select(".domain").attr("stroke", "var(--border)"));

    // IQR boxes
    const bw = x.bandwidth();
    const groups = g.selectAll("g.box")
      .data(decadeData)
      .join("g")
      .attr("class", "box");

    // Q1–Q3 box
    groups.append("rect")
      .attr("x", (d) => x(d.decade))
      .attr("width", bw)
      .attr("y", (d) => y(d.q3))
      .attr("height", (d) => y(d.q1) - y(d.q3))
      .attr("fill", "#5b9bd5")
      .attr("opacity", 0.4)
      .attr("rx", 2);

    // Median line
    groups.append("line")
      .attr("x1", (d) => x(d.decade))
      .attr("x2", (d) => x(d.decade) + bw)
      .attr("y1", (d) => y(d.median))
      .attr("y2", (d) => y(d.median))
      .attr("stroke", "#5b9bd5")
      .attr("stroke-width", 2);

    // Mean dot
    groups.append("circle")
      .attr("cx", (d) => x(d.decade) + bw / 2)
      .attr("cy", (d) => y(d.avg))
      .attr("r", 4)
      .attr("fill", "var(--fg)")
      .attr("opacity", 0.8);

    // Count label
    groups.append("text")
      .attr("x", (d) => x(d.decade) + bw / 2)
      .attr("y", (d) => y(d.q3) - 8)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--fg-ghost)")
      .attr("font-family", "var(--font-mono)")
      .attr("font-size", 8)
      .text((d) => `n=${d.count}`);

  }, [decadeData]);

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)", overflowX: "auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 4 }}>Ensemble Size</h1>
      <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}>
        How many musicians per album, by decade (box: IQR, dot: mean)
      </p>
      <svg ref={svgRef} />
    </div>
  );
}
