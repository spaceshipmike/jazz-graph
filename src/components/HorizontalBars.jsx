import { useRef, useEffect } from "react";
import * as d3 from "d3";

/**
 * Horizontal bar chart.
 * data: [{ label, value, color }] — sorted by value descending
 */
export default function HorizontalBars({
  data,
  maxBars = 20,
  onBarClick,
}) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const items = data.slice(0, maxBars);
    const margin = { top: 8, right: 50, bottom: 8, left: 140 };
    const barHeight = 24;
    const barGap = 4;
    const width = 700;
    const height = margin.top + margin.bottom + items.length * (barHeight + barGap);

    svg.attr("width", width).attr("height", height);

    const x = d3.scaleLinear()
      .domain([0, d3.max(items, (d) => d.value)])
      .range([margin.left, width - margin.right]);

    const g = svg.append("g");

    const rows = g.selectAll("g.row")
      .data(items)
      .join("g")
      .attr("class", "row")
      .attr("transform", (d, i) => `translate(0,${margin.top + i * (barHeight + barGap)})`)
      .attr("cursor", onBarClick ? "pointer" : "default")
      .on("click", (event, d) => { if (onBarClick) onBarClick(d); });

    // Bar
    rows.append("rect")
      .attr("x", margin.left)
      .attr("y", 0)
      .attr("width", (d) => x(d.value) - margin.left)
      .attr("height", barHeight)
      .attr("fill", (d) => d.color)
      .attr("opacity", 0.7)
      .attr("rx", 3);

    // Hover
    rows.on("mouseenter", function () {
      d3.select(this).select("rect").attr("opacity", 1);
    }).on("mouseleave", function () {
      d3.select(this).select("rect").attr("opacity", 0.7);
    });

    // Label
    rows.append("text")
      .attr("x", margin.left - 8)
      .attr("y", barHeight / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .attr("fill", "var(--fg-dim)")
      .attr("font-family", "var(--font-mono)")
      .attr("font-size", 11)
      .text((d) => d.label);

    // Value
    rows.append("text")
      .attr("x", (d) => x(d.value) + 6)
      .attr("y", barHeight / 2)
      .attr("dy", "0.35em")
      .attr("fill", "var(--fg-ghost)")
      .attr("font-family", "var(--font-mono)")
      .attr("font-size", 10)
      .attr("font-weight", 600)
      .text((d) => d.value);

  }, [data, maxBars, onBarClick]);

  return <svg ref={svgRef} />;
}
