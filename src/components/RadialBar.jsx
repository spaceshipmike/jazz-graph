import { useRef, useEffect } from "react";
import * as d3 from "d3";

/**
 * Radial bar chart using D3.
 *
 * data: [{ label, value, color }] — sorted by value descending
 * size: pixel width/height of the SVG (square)
 * innerRadius: fraction of size/2 for the hole (0-1)
 */
export default function RadialBar({
  data,
  size = 600,
  innerRadius = 0.3,
  maxBars = 24,
  onBarClick,
}) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const items = data.slice(0, maxBars);
    const margin = 120; // room for rotated labels
    const width = size;
    const height = size;
    const outerR = Math.min(width, height) / 2 - margin;
    const innerR = outerR * innerRadius;

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    const angleScale = d3
      .scaleBand()
      .domain(items.map((d) => d.label))
      .range([0, 2 * Math.PI])
      .padding(0.12);

    const radiusScale = d3
      .scaleLinear()
      .domain([0, d3.max(items, (d) => d.value)])
      .range([innerR, outerR]);

    // Bars
    g.selectAll("path")
      .data(items)
      .join("path")
      .attr("d", d3.arc()
        .innerRadius(innerR)
        .outerRadius((d) => radiusScale(d.value))
        .startAngle((d) => angleScale(d.label))
        .endAngle((d) => angleScale(d.label) + angleScale.bandwidth())
        .padAngle(0.01)
        .padRadius(innerR)
      )
      .attr("fill", (d) => d.color)
      .attr("opacity", 0.85)
      .attr("cursor", onBarClick ? "pointer" : "default")
      .on("mouseenter", function () {
        d3.select(this).attr("opacity", 1);
      })
      .on("mouseleave", function () {
        d3.select(this).attr("opacity", 0.85);
      })
      .on("click", (event, d) => {
        if (onBarClick) onBarClick(d);
      });

    // Labels — positioned outside the longest bar
    const maxR = outerR + 8;
    g.selectAll("text.label")
      .data(items)
      .join("text")
      .attr("class", "label")
      .attr("text-anchor", (d) => {
        const angle = angleScale(d.label) + angleScale.bandwidth() / 2;
        return angle > Math.PI ? "end" : "start";
      })
      .attr("transform", (d) => {
        const angle = angleScale(d.label) + angleScale.bandwidth() / 2;
        const degrees = (angle * 180) / Math.PI - 90;
        const flip = angle > Math.PI;
        return `rotate(${degrees}) translate(${maxR},0) rotate(${flip ? 180 : 0})`;
      })
      .attr("dy", "0.35em")
      .attr("fill", "var(--fg-dim)")
      .attr("font-family", "var(--font-mono)")
      .attr("font-size", 9)
      .text((d) => d.label);

    // Value labels (inside arc)
    g.selectAll("text.value")
      .data(items)
      .join("text")
      .attr("class", "value")
      .attr("text-anchor", "middle")
      .attr("transform", (d) => {
        const angle = angleScale(d.label) + angleScale.bandwidth() / 2;
        const r = innerR + (radiusScale(d.value) - innerR) / 2;
        const x = r * Math.cos(angle - Math.PI / 2);
        const y = r * Math.sin(angle - Math.PI / 2);
        return `translate(${x},${y})`;
      })
      .attr("dy", "0.35em")
      .attr("fill", "var(--fg)")
      .attr("font-family", "var(--font-mono)")
      .attr("font-size", 8)
      .attr("font-weight", 600)
      .attr("opacity", (d) => {
        const barWidth = radiusScale(d.value) - innerR;
        return barWidth > 20 ? 0.9 : 0;
      })
      .text((d) => d.value);

  }, [data, size, innerRadius, maxBars, onBarClick]);

  return (
    <div style={{ display: "flex", justifyContent: "center", overflow: "visible" }}>
      <svg ref={svgRef} style={{ overflow: "visible" }} />
    </div>
  );
}
