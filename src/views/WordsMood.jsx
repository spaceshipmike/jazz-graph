import { useMemo, useRef, useEffect, useState } from "react";
import { useData } from "../App";
import { getAllTitles, countKeywords, MOOD_CATEGORIES } from "../titleAnalysis";
import { Link } from "react-router-dom";
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

const MOOD_LABELS = {
  joy: "Joy",
  love: "Love",
  melancholy: "Melancholy",
  longing: "Longing",
  peace: "Peace",
  freedom: "Freedom",
  night: "Night",
  fire: "Fire",
};

// ─── Drill-down: find matching albums/tracks ────────────────────────

function findMatches(albums, keyword) {
  const regex = new RegExp(`\\b${keyword}\\b`, "i");
  const matches = [];
  for (const a of albums) {
    const albumMatch = regex.test(a.title);
    const trackMatches = (a.tracks || []).filter((t) => regex.test(t.title));
    if (albumMatch || trackMatches.length > 0) {
      matches.push({
        album: a,
        albumMatch,
        tracks: trackMatches,
      });
    }
  }
  return matches.sort((a, b) => (b.albumMatch ? 1 : 0) + b.tracks.length - (a.albumMatch ? 1 : 0) - a.tracks.length);
}

// ─── Radial Wheel ───────────────────────────────────────────────────

function RadialWheel({ moodData, onSelect, selected }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || moodData.length === 0) return;

    const containerWidth = containerRef.current.clientWidth;
    const size = Math.min(containerWidth, 620);
    const pad = 60;
    const cx = size / 2;
    const cy = size / 2;
    const innerR = 50;
    const outerR = size / 2 - pad;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", size).attr("height", size);

    const g = svg.append("g");

    const categories = Object.keys(moodData);
    const angleStep = (2 * Math.PI) / categories.length;

    // Max word count for scaling
    const allCounts = categories.flatMap((cat) =>
      Object.values(moodData[cat]).map((c) => c)
    );
    const maxCount = d3.max(allCounts) || 1;
    const rScale = d3.scaleSqrt().domain([0, maxCount]).range([4, 18]);

    categories.forEach((cat, i) => {
      const angle = i * angleStep - Math.PI / 2; // start from top
      const color = MOOD_COLORS[cat] || "#888";
      const words = Object.entries(moodData[cat]).sort((a, b) => b[1] - a[1]);
      const catTotal = words.reduce((s, [, c]) => s + c, 0);
      if (catTotal === 0) return;

      const isSelected = selected?.category === cat;
      const hasSelection = !!selected;
      const faded = hasSelection && !isSelected;

      // Spoke line
      g.append("line")
        .attr("x1", cx + Math.cos(angle) * innerR)
        .attr("y1", cy + Math.sin(angle) * innerR)
        .attr("x2", cx + Math.cos(angle) * outerR)
        .attr("y2", cy + Math.sin(angle) * outerR)
        .attr("stroke", color)
        .attr("stroke-opacity", faded ? 0.06 : isSelected ? 0.4 : 0.2)
        .attr("stroke-width", 1);

      // Category label at end of spoke
      const labelR = outerR + 16;
      const lx = cx + Math.cos(angle) * labelR;
      const ly = cy + Math.sin(angle) * labelR;

      const catGroup = g.append("g")
        .style("cursor", "pointer")
        .on("click", () => onSelect({ category: cat, keyword: null }));

      catGroup.append("text")
        .attr("x", lx)
        .attr("y", ly)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", faded ? "var(--fg-ghost)" : color)
        .attr("font-family", "var(--font-mono)")
        .attr("font-size", 10)
        .attr("font-weight", isSelected && !selected?.keyword ? 700 : 400)
        .attr("opacity", faded ? 0.4 : 1)
        .text(MOOD_LABELS[cat]);

      catGroup.append("text")
        .attr("x", lx)
        .attr("y", ly + 13)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--fg-ghost)")
        .attr("font-family", "var(--font-mono)")
        .attr("font-size", 8)
        .attr("opacity", faded ? 0.3 : 1)
        .text(catTotal);

      // Word nodes along spoke
      const spokeLen = outerR - innerR;
      words.forEach(([word, count], wi) => {
        const t = (wi + 1) / (words.length + 1);
        const r = innerR + t * spokeLen;
        // Slight perpendicular jitter for overlapping nodes
        const jitter = (wi % 2 === 0 ? 1 : -1) * (wi > 0 ? 6 : 0);
        const perpAngle = angle + Math.PI / 2;
        const nx = cx + Math.cos(angle) * r + Math.cos(perpAngle) * jitter;
        const ny = cy + Math.sin(angle) * r + Math.sin(perpAngle) * jitter;
        const nodeR = rScale(count);
        const isWordSelected = selected?.category === cat && selected?.keyword === word;

        const node = g.append("g")
          .style("cursor", "pointer")
          .on("click", () => onSelect({ category: cat, keyword: word }));

        const nodeFaded = faded || (isSelected && selected?.keyword && !isWordSelected);

        node.append("circle")
          .attr("cx", nx)
          .attr("cy", ny)
          .attr("r", nodeR)
          .attr("fill", color)
          .attr("fill-opacity", nodeFaded ? 0.08 : isWordSelected ? 0.9 : 0.65)
          .attr("stroke", isWordSelected ? color : "none")
          .attr("stroke-width", 1.5);

        // Label for larger nodes
        if (nodeR > 7) {
          node.append("text")
            .attr("x", nx)
            .attr("y", ny)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", nodeFaded ? "var(--fg-ghost)" : isWordSelected ? "#fff" : "var(--fg)")
            .attr("font-family", "var(--font-mono)")
            .attr("font-size", Math.min(nodeR * 0.9, 9))
            .attr("pointer-events", "none")
            .attr("opacity", nodeFaded ? 0.3 : 1)
            .text(word);
        }

        // Tooltip on hover for smaller nodes
        node.append("title").text(`${word}: ${count}`);
      });
    });

    // Center circle
    g.append("circle")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", innerR - 5)
      .attr("fill", "var(--surface)")
      .attr("stroke", "var(--border)")
      .attr("stroke-width", 1);

    g.append("text")
      .attr("x", cx)
      .attr("y", cy - 6)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--fg-dim)")
      .attr("font-family", "var(--font-display)")
      .attr("font-size", 14)
      .attr("font-weight", 300)
      .text("Mood");

    const totalHits = categories.reduce(
      (s, cat) => s + Object.values(moodData[cat]).reduce((a, b) => a + b, 0),
      0
    );
    g.append("text")
      .attr("x", cx)
      .attr("y", cy + 10)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--fg-ghost)")
      .attr("font-family", "var(--font-mono)")
      .attr("font-size", 9)
      .text(`${totalHits} hits`);

  }, [moodData, selected, onSelect]);

  return (
    <div ref={containerRef} style={{ display: "flex", justifyContent: "center" }}>
      <svg ref={svgRef} style={{ display: "block" }} />
    </div>
  );
}

// ─── Mood by Decade Heatmap ─────────────────────────────────────────

function MoodByDecade({ albums }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  const decadeData = useMemo(() => {
    // Group albums by decade
    const decades = {};
    for (const a of albums) {
      if (!a.year) continue;
      const decade = Math.floor(a.year / 10) * 10;
      if (!decades[decade]) decades[decade] = [];
      decades[decade].push(a);
    }

    // For each decade, count mood keywords
    const result = {};
    for (const [decade, decadeAlbums] of Object.entries(decades)) {
      const titles = getAllTitles(decadeAlbums);
      const counts = countKeywords(titles, MOOD_CATEGORIES);
      result[decade] = {};
      for (const [cat, words] of Object.entries(counts)) {
        result[decade][cat] = Object.values(words).reduce((s, c) => s + c, 0);
      }
    }
    return result;
  }, [albums]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const decades = Object.keys(decadeData).map(Number).sort();
    if (decades.length === 0) return;

    const categories = Object.keys(MOOD_CATEGORIES);
    const containerWidth = containerRef.current.clientWidth;
    const margin = { top: 30, right: 20, bottom: 40, left: 80 };
    const cellW = Math.min(60, (containerWidth - margin.left - margin.right) / decades.length);
    const cellH = 28;
    const width = margin.left + decades.length * cellW + margin.right;
    const height = margin.top + categories.length * cellH + margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Max value for color scale
    const allVals = decades.flatMap((d) =>
      categories.map((c) => decadeData[d]?.[c] || 0)
    );
    const maxVal = d3.max(allVals) || 1;

    // Draw cells
    categories.forEach((cat, row) => {
      const color = MOOD_COLORS[cat] || "#888";
      const colorScale = d3.scaleSequential(
        [0, maxVal],
        (t) => d3.interpolate("var(--surface)", color)(Math.sqrt(t / maxVal))
      );

      decades.forEach((decade, col) => {
        const val = decadeData[decade]?.[cat] || 0;
        const intensity = val / maxVal;

        g.append("rect")
          .attr("x", col * cellW)
          .attr("y", row * cellH)
          .attr("width", cellW - 2)
          .attr("height", cellH - 2)
          .attr("rx", 3)
          .attr("fill", color)
          .attr("fill-opacity", Math.max(0.05, Math.sqrt(intensity) * 0.85))
          .append("title")
          .text(`${MOOD_LABELS[cat]} in ${decade}s: ${val}`);

        if (val > 0) {
          g.append("text")
            .attr("x", col * cellW + (cellW - 2) / 2)
            .attr("y", row * cellH + (cellH - 2) / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", intensity > 0.3 ? "#fff" : "var(--fg-ghost)")
            .attr("font-family", "var(--font-mono)")
            .attr("font-size", 9)
            .attr("pointer-events", "none")
            .text(val);
        }
      });

      // Row labels
      g.append("text")
        .attr("x", -8)
        .attr("y", row * cellH + (cellH - 2) / 2)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .attr("fill", color)
        .attr("font-family", "var(--font-mono)")
        .attr("font-size", 10)
        .text(MOOD_LABELS[cat]);
    });

    // Column labels (decades)
    decades.forEach((decade, col) => {
      g.append("text")
        .attr("x", col * cellW + (cellW - 2) / 2)
        .attr("y", categories.length * cellH + 16)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--fg-muted)")
        .attr("font-family", "var(--font-mono)")
        .attr("font-size", 9)
        .text(`${decade}s`);
    });

  }, [decadeData]);

  return (
    <div ref={containerRef} style={{ overflowX: "auto" }}>
      <svg ref={svgRef} style={{ display: "block" }} />
    </div>
  );
}

// ─── Drill-down Panel ───────────────────────────────────────────────

function DrillDown({ albums, selected }) {
  const matches = useMemo(() => {
    if (!selected) return [];
    if (selected.keyword) {
      return findMatches(albums, selected.keyword);
    }
    // Category-level: find all matches for all keywords in the category
    const keywords = MOOD_CATEGORIES[selected.category] || [];
    const combined = new Map();
    for (const kw of keywords) {
      for (const m of findMatches(albums, kw)) {
        if (!combined.has(m.album.id)) {
          combined.set(m.album.id, m);
        }
      }
    }
    return [...combined.values()];
  }, [albums, selected]);

  if (!selected || matches.length === 0) return null;

  const color = MOOD_COLORS[selected.category] || "#888";
  const label = selected.keyword
    ? `"${selected.keyword}" in ${MOOD_LABELS[selected.category]}`
    : MOOD_LABELS[selected.category];

  return (
    <div style={{ marginTop: "var(--space-lg)" }}>
      <h3 className="mono" style={{ fontSize: 10, color: "var(--fg-ghost)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "var(--space-sm)" }}>
        <span style={{ color }}>{label}</span> — {matches.length} albums
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 6 }}>
        {matches.slice(0, 40).map(({ album: a, albumMatch, tracks }) => (
          <Link
            key={a.id}
            to={`/album/${a.id}`}
            style={{
              display: "flex",
              gap: "var(--space-sm)",
              padding: "8px 10px",
              background: "var(--surface)",
              borderRadius: "var(--radius-sm)",
              borderLeft: `3px solid ${color}`,
              textDecoration: "none",
              transition: "var(--ease-default)",
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 3, overflow: "hidden", flexShrink: 0, background: "var(--bg)" }}>
              {a.coverPath ? (
                <img src={`/data/${a.coverPath}`} alt={a.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
              ) : null}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: albumMatch ? 600 : 400, color: albumMatch ? "var(--fg)" : "var(--fg-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {a.title}
              </div>
              <div className="mono" style={{ fontSize: 9, color: "var(--fg-muted)" }}>
                {a.artist} · {a.year || "?"}
              </div>
              {tracks.length > 0 && (
                <div className="mono" style={{ fontSize: 8, color, marginTop: 2 }}>
                  {tracks.slice(0, 3).map((t) => t.title).join(", ")}
                  {tracks.length > 3 && ` +${tracks.length - 3}`}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
      {matches.length > 40 && (
        <p className="mono" style={{ fontSize: 9, color: "var(--fg-ghost)", marginTop: 8 }}>
          +{matches.length - 40} more
        </p>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export default function WordsMood() {
  const { albums } = useData();
  const [selected, setSelected] = useState(null);

  const moodData = useMemo(() => {
    const titles = getAllTitles(albums);
    return countKeywords(titles, MOOD_CATEGORIES);
  }, [albums]);

  const handleSelect = (sel) => {
    // Toggle off if clicking the same thing
    if (selected && selected.category === sel.category && selected.keyword === sel.keyword) {
      setSelected(null);
    } else {
      setSelected(sel);
    }
  };

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)" }}>
      <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 4 }}>Mood</h1>
      <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}>
        Emotional themes in song and album titles — click a spoke to explore
      </p>

      <RadialWheel moodData={moodData} onSelect={handleSelect} selected={selected} />
      <DrillDown albums={albums} selected={selected} />

      <section style={{ marginTop: "var(--space-2xl)" }}>
        <h2 style={{ fontSize: 20, fontWeight: 300, marginBottom: 4 }}>Mood by Decade</h2>
        <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-md)" }}>
          How jazz's emotional vocabulary shifted across eras
        </p>
        <MoodByDecade albums={albums} />
      </section>
    </div>
  );
}
