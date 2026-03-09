import { useMemo, useRef, useEffect } from "react";
import { useData } from "../App";
import { getAllTitles, countKeywords, MUSIC_VOCABULARY } from "../titleAnalysis";
import * as d3 from "d3";

const SECTION_COLORS = {
  forms: "#e85d3a",
  slang: "#d4a843",
  structure: "#5b9bd5",
};

export default function WordsVocabulary() {
  const { albums } = useData();
  const svgRef = useRef(null);

  const vocabData = useMemo(() => {
    const titles = getAllTitles(albums);
    const counts = countKeywords(titles, MUSIC_VOCABULARY);

    const sections = [];
    for (const [section, words] of Object.entries(counts)) {
      const items = Object.entries(words)
        .map(([word, count]) => ({ word, count }))
        .sort((a, b) => b.count - a.count);
      if (items.length > 0) {
        sections.push({ section, items, total: items.reduce((s, i) => s + i.count, 0) });
      }
    }
    return sections.sort((a, b) => b.total - a.total);
  }, [albums]);

  useEffect(() => {
    if (vocabData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 800;
    const allItems = vocabData.flatMap((s) =>
      s.items.map((i) => ({ ...i, section: s.section }))
    );

    // Treemap layout
    const root = d3.hierarchy({
      children: vocabData.map((s) => ({
        name: s.section,
        children: s.items.map((i) => ({
          name: i.word,
          value: i.count,
          section: s.section,
        })),
      })),
    }).sum((d) => d.value);

    const height = 450;
    svg.attr("width", width).attr("height", height);

    d3.treemap()
      .size([width, height])
      .padding(2)
      .paddingTop(20)
      .round(true)(root);

    const g = svg.append("g");

    // Section backgrounds
    const sections = g.selectAll("g.section")
      .data(root.children)
      .join("g")
      .attr("class", "section");

    sections.append("rect")
      .attr("x", (d) => d.x0)
      .attr("y", (d) => d.y0)
      .attr("width", (d) => d.x1 - d.x0)
      .attr("height", (d) => d.y1 - d.y0)
      .attr("fill", "none")
      .attr("stroke", (d) => SECTION_COLORS[d.data.name] || "#888")
      .attr("stroke-opacity", 0.3);

    sections.append("text")
      .attr("x", (d) => d.x0 + 6)
      .attr("y", (d) => d.y0 + 13)
      .attr("fill", (d) => SECTION_COLORS[d.data.name] || "#888")
      .attr("font-family", "var(--font-mono)")
      .attr("font-size", 10)
      .attr("font-weight", 700)
      .attr("text-transform", "uppercase")
      .text((d) => d.data.name);

    // Word cells
    const leaves = g.selectAll("g.leaf")
      .data(root.leaves())
      .join("g")
      .attr("class", "leaf");

    leaves.append("rect")
      .attr("x", (d) => d.x0)
      .attr("y", (d) => d.y0)
      .attr("width", (d) => d.x1 - d.x0)
      .attr("height", (d) => d.y1 - d.y0)
      .attr("fill", (d) => SECTION_COLORS[d.data.section] || "#888")
      .attr("opacity", 0.2)
      .attr("rx", 2)
      .on("mouseenter", function () { d3.select(this).attr("opacity", 0.4); })
      .on("mouseleave", function () { d3.select(this).attr("opacity", 0.2); });

    // Word labels (only if cell is big enough)
    leaves
      .filter((d) => (d.x1 - d.x0) > 30 && (d.y1 - d.y0) > 18)
      .append("text")
      .attr("x", (d) => d.x0 + (d.x1 - d.x0) / 2)
      .attr("y", (d) => d.y0 + (d.y1 - d.y0) / 2)
      .attr("text-anchor", "middle")
      .attr("dy", "-0.2em")
      .attr("fill", "var(--fg)")
      .attr("font-family", "var(--font-mono)")
      .attr("font-size", (d) => Math.min(12, (d.x1 - d.x0) / 5))
      .text((d) => d.data.name);

    leaves
      .filter((d) => (d.x1 - d.x0) > 30 && (d.y1 - d.y0) > 28)
      .append("text")
      .attr("x", (d) => d.x0 + (d.x1 - d.x0) / 2)
      .attr("y", (d) => d.y0 + (d.y1 - d.y0) / 2)
      .attr("text-anchor", "middle")
      .attr("dy", "1.1em")
      .attr("fill", "var(--fg-ghost)")
      .attr("font-family", "var(--font-mono)")
      .attr("font-size", 8)
      .text((d) => d.value);

  }, [vocabData]);

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)", overflowX: "auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 4 }}>Musical Vocabulary</h1>
      <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}>
        How jazz names its own forms, slang, and structures
      </p>
      <svg ref={svgRef} />
    </div>
  );
}
