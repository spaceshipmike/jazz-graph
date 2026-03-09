import { useMemo, useRef, useEffect } from "react";
import { useData } from "../App";
import { getAllTitles, countKeywords, MOOD_CATEGORIES } from "../titleAnalysis";
import * as d3 from "d3";

const MOOD_COLORS = {
  joy: "#d4a843",
  love: "#c75d8f",
  melancholy: "#5b9bd5",
  longing: "#7c5cbf",
  peace: "#6bb5a0",
  freedom: "#e85d3a",
  night: "#555",
  fire: "#c44425",
};

export default function WordsMood() {
  const { albums } = useData();
  const svgRef = useRef(null);

  const moodData = useMemo(() => {
    const titles = getAllTitles(albums);
    const counts = countKeywords(titles, MOOD_CATEGORIES);

    // Flatten into nodes for force layout
    const nodes = [];
    for (const [category, words] of Object.entries(counts)) {
      const total = Object.values(words).reduce((s, c) => s + c, 0);
      if (total === 0) continue;
      // Category node
      nodes.push({
        id: category,
        label: category,
        value: total,
        color: MOOD_COLORS[category] || "#888",
        isCategory: true,
      });
      // Word nodes
      for (const [word, count] of Object.entries(words)) {
        nodes.push({
          id: `${category}-${word}`,
          label: word,
          value: count,
          color: MOOD_COLORS[category] || "#888",
          category,
          isCategory: false,
        });
      }
    }
    return nodes;
  }, [albums]);

  useEffect(() => {
    if (moodData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 800;
    const height = 500;

    svg.attr("width", width).attr("height", height);

    const sizeScale = d3.scaleSqrt()
      .domain([1, d3.max(moodData, (d) => d.value)])
      .range([6, 40]);

    const simulation = d3.forceSimulation(moodData)
      .force("x", d3.forceX(width / 2).strength(0.05))
      .force("y", d3.forceY(height / 2).strength(0.05))
      .force("charge", d3.forceManyBody().strength((d) => d.isCategory ? -80 : -15))
      .force("collide", d3.forceCollide((d) => sizeScale(d.value) + 3))
      .stop();

    // Run simulation synchronously
    for (let i = 0; i < 200; i++) simulation.tick();

    const g = svg.append("g");

    const bubbles = g.selectAll("g.bubble")
      .data(moodData)
      .join("g")
      .attr("class", "bubble")
      .attr("transform", (d) => `translate(${d.x},${d.y})`);

    bubbles.append("circle")
      .attr("r", (d) => sizeScale(d.value))
      .attr("fill", (d) => d.color)
      .attr("opacity", (d) => d.isCategory ? 0.5 : 0.35)
      .attr("stroke", (d) => d.isCategory ? d.color : "none")
      .attr("stroke-width", (d) => d.isCategory ? 1.5 : 0);

    bubbles
      .filter((d) => sizeScale(d.value) > 12)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "var(--fg)")
      .attr("font-family", "var(--font-mono)")
      .attr("font-size", (d) => d.isCategory ? 11 : 8)
      .attr("font-weight", (d) => d.isCategory ? 700 : 400)
      .text((d) => d.label);

    bubbles
      .filter((d) => sizeScale(d.value) > 18)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => d.isCategory ? "1.6em" : "1.4em")
      .attr("fill", "var(--fg-ghost)")
      .attr("font-family", "var(--font-mono)")
      .attr("font-size", 7)
      .text((d) => d.value);

  }, [moodData]);

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)", overflowX: "auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 4 }}>Mood</h1>
      <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}>
        Emotional themes in song and album titles
      </p>
      <svg ref={svgRef} />
    </div>
  );
}
