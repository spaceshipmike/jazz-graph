import { useMemo, useRef, useEffect } from "react";
import { useData } from "../App";
import { getAllTitles, countKeywords, IMAGERY_CATEGORIES } from "../titleAnalysis";
import * as d3 from "d3";

const CATEGORY_COLORS = {
  "time-of-day": "#d4a843",
  seasons: "#6bb5a0",
  weather: "#5b9bd5",
  celestial: "#7c5cbf",
  nature: "#45a67d",
};

const CATEGORY_LABELS = {
  "time-of-day": "Time of Day",
  seasons: "Seasons",
  weather: "Weather",
  celestial: "Celestial",
  nature: "Nature",
};

export default function WordsImagery() {
  const { albums } = useData();
  const svgRef = useRef(null);

  const imageryData = useMemo(() => {
    const titles = getAllTitles(albums);
    const counts = countKeywords(titles, IMAGERY_CATEGORIES);

    const sections = [];
    for (const [cat, wordCounts] of Object.entries(counts)) {
      const words = Object.entries(wordCounts)
        .map(([word, count]) => ({ word, count }))
        .sort((a, b) => b.count - a.count);
      if (words.length > 0) {
        sections.push({ category: cat, words });
      }
    }
    return sections;
  }, [albums]);

  useEffect(() => {
    if (imageryData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 10, right: 30, bottom: 20, left: 90 };
    const barHeight = 16;
    const sectionGap = 30;
    const sectionLabelHeight = 24;
    const width = 700;

    // Calculate total height
    let totalRows = 0;
    for (const s of imageryData) totalRows += s.words.length;
    const height = margin.top + margin.bottom +
      totalRows * (barHeight + 2) +
      imageryData.length * (sectionGap + sectionLabelHeight);

    svg.attr("width", width).attr("height", height);

    const maxCount = d3.max(imageryData.flatMap((s) => s.words.map((w) => w.count)));

    const x = d3.scaleLinear()
      .domain([0, maxCount])
      .range([margin.left, width - margin.right]);

    const g = svg.append("g");

    let yOffset = margin.top;

    for (const section of imageryData) {
      const color = CATEGORY_COLORS[section.category] || "#888";
      const label = CATEGORY_LABELS[section.category] || section.category;

      // Section label
      g.append("text")
        .attr("x", margin.left)
        .attr("y", yOffset + 14)
        .attr("fill", color)
        .attr("font-family", "var(--font-mono)")
        .attr("font-size", 11)
        .attr("font-weight", 700)
        .attr("text-transform", "uppercase")
        .text(label);

      yOffset += sectionLabelHeight;

      // Bars
      for (const word of section.words) {
        // Bar
        g.append("rect")
          .attr("x", margin.left)
          .attr("y", yOffset)
          .attr("width", x(word.count) - margin.left)
          .attr("height", barHeight)
          .attr("fill", color)
          .attr("opacity", 0.5)
          .attr("rx", 2);

        // Word label
        g.append("text")
          .attr("x", margin.left - 6)
          .attr("y", yOffset + barHeight / 2)
          .attr("dy", "0.35em")
          .attr("text-anchor", "end")
          .attr("fill", "var(--fg-dim)")
          .attr("font-family", "var(--font-mono)")
          .attr("font-size", 9)
          .text(word.word);

        // Count
        g.append("text")
          .attr("x", x(word.count) + 5)
          .attr("y", yOffset + barHeight / 2)
          .attr("dy", "0.35em")
          .attr("fill", "var(--fg-ghost)")
          .attr("font-family", "var(--font-mono)")
          .attr("font-size", 8)
          .text(word.count);

        yOffset += barHeight + 2;
      }

      yOffset += sectionGap;
    }

  }, [imageryData]);

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)", overflowX: "auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 4 }}>Imagery</h1>
      <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}>
        Time, seasons, weather, and nature in jazz titles
      </p>
      <svg ref={svgRef} />
    </div>
  );
}
