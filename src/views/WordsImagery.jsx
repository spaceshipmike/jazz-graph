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

// Clock positions for time-of-day keywords (hours on 24h clock)
const CLOCK_POSITIONS = {
  dawn: 5, sunrise: 6, morning: 8, noon: 12, afternoon: 14,
  evening: 18, sunset: 19, dusk: 20, twilight: 21, night: 23, midnight: 0,
};

// Season angles (radians, starting from top)
const SEASON_ANGLES = {
  spring: 0, summer: Math.PI / 2, autumn: Math.PI, fall: Math.PI, winter: (3 * Math.PI) / 2,
};

// Weather keywords → season affinity
const WEATHER_SEASON = {
  rain: "spring", rainy: "spring", storm: "summer", stormy: "summer",
  thunder: "summer", lightning: "summer", wind: "autumn", windy: "autumn",
  cloud: "autumn", clouds: "autumn", cloudy: "autumn",
  snow: "winter", fog: "winter", mist: "winter",
  sunshine: "summer", sunny: "summer",
};

export default function WordsImagery() {
  const { albums } = useData();
  const clockRef = useRef(null);
  const seasonRef = useRef(null);
  const natureRef = useRef(null);

  const imageryData = useMemo(() => {
    const titles = getAllTitles(albums);
    return countKeywords(titles, IMAGERY_CATEGORIES);
  }, [albums]);

  // Clock face — time of day
  useEffect(() => {
    const data = imageryData["time-of-day"];
    if (!data || !clockRef.current) return;

    const svg = d3.select(clockRef.current);
    svg.selectAll("*").remove();

    const size = 500;
    const cx = size / 2, cy = size / 2;
    const outerR = 210, innerR = 60;
    const color = CATEGORY_COLORS["time-of-day"];

    svg.attr("width", size).attr("height", size).attr("viewBox", `0 0 ${size} ${size}`);
    const g = svg.append("g");

    // Dark/light background gradient — night is dark, day is lighter
    const defs = svg.append("defs");
    const grad = defs.append("radialGradient").attr("id", "clock-bg");
    grad.append("stop").attr("offset", "0%").attr("stop-color", "var(--surface)");
    grad.append("stop").attr("offset", "100%").attr("stop-color", "var(--bg)");

    g.append("circle").attr("cx", cx).attr("cy", cy).attr("r", outerR + 8)
      .attr("fill", "url(#clock-bg)").attr("stroke", "var(--border)").attr("stroke-width", 0.5);

    // Hour tick marks
    for (let h = 0; h < 24; h++) {
      const angle = (h / 24) * Math.PI * 2 - Math.PI / 2;
      const r1 = outerR + 3, r2 = outerR + (h % 6 === 0 ? 10 : 6);
      g.append("line")
        .attr("x1", cx + r1 * Math.cos(angle)).attr("y1", cy + r1 * Math.sin(angle))
        .attr("x2", cx + r2 * Math.cos(angle)).attr("y2", cy + r2 * Math.sin(angle))
        .attr("stroke", "var(--border-light)").attr("stroke-width", h % 6 === 0 ? 1 : 0.5);
    }

    // Keyword bubbles
    const maxCount = d3.max(Object.values(data)) || 1;
    const rScale = d3.scaleSqrt().domain([1, maxCount]).range([8, 42]);

    const words = Object.entries(data).sort((a, b) => b[1] - a[1]);

    for (const [word, count] of words) {
      const hour = CLOCK_POSITIONS[word];
      if (hour === undefined) continue;
      const angle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
      // Stagger night(23h) inward and midnight(0h) outward to avoid overlap
      const stagger = word === "night" ? 0.35 : word === "midnight" ? 0.72 : 0.55;
      const dist = innerR + (outerR - innerR) * stagger;
      const bx = cx + dist * Math.cos(angle);
      const by = cy + dist * Math.sin(angle);
      const r = rScale(count);

      g.append("circle")
        .attr("cx", bx).attr("cy", by).attr("r", r)
        .attr("fill", color).attr("fill-opacity", 0.25)
        .attr("stroke", color).attr("stroke-opacity", 0.6).attr("stroke-width", 1);

      if (r > 14) {
        g.append("text")
          .attr("x", bx).attr("y", by - 2)
          .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
          .attr("fill", color).attr("font-family", "var(--font-mono)")
          .attr("font-size", Math.min(12, r * 0.6))
          .text(word);
        g.append("text")
          .attr("x", bx).attr("y", by + 11)
          .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
          .attr("fill", "var(--fg-ghost)").attr("font-family", "var(--font-mono)")
          .attr("font-size", 9)
          .text(count);
      } else {
        // Small label outside
        const lDist = dist + r + 14;
        g.append("text")
          .attr("x", cx + lDist * Math.cos(angle)).attr("y", cy + lDist * Math.sin(angle))
          .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
          .attr("fill", "var(--fg-ghost)").attr("font-family", "var(--font-mono)")
          .attr("font-size", 10)
          .text(`${word} ${count}`);
      }
    }

    // Center label
    g.append("text").attr("x", cx).attr("y", cy - 6)
      .attr("text-anchor", "middle").attr("fill", "var(--fg-dim)")
      .attr("font-family", "var(--font-mono)").attr("font-size", 12).attr("font-weight", 600)
      .text("time");
    g.append("text").attr("x", cx).attr("y", cy + 10)
      .attr("text-anchor", "middle").attr("fill", "var(--fg-ghost)")
      .attr("font-family", "var(--font-mono)").attr("font-size", 10)
      .text("of day");

  }, [imageryData]);

  // Seasonal arc — seasons + weather
  useEffect(() => {
    const seasonData = imageryData["seasons"] || {};
    const weatherData = imageryData["weather"] || {};
    if (!seasonRef.current) return;

    const svg = d3.select(seasonRef.current);
    svg.selectAll("*").remove();

    const size = 500;
    const cx = size / 2, cy = size / 2;
    const outerR = 195, innerR = 75;
    const seasonColor = CATEGORY_COLORS["seasons"];
    const weatherColor = CATEGORY_COLORS["weather"];

    svg.attr("width", size).attr("height", size).attr("viewBox", `0 0 ${size} ${size}`);
    const g = svg.append("g");

    // Background ring
    g.append("circle").attr("cx", cx).attr("cy", cy).attr("r", outerR + 4)
      .attr("fill", "none").attr("stroke", "var(--border)").attr("stroke-width", 0.5);

    // 4 season wedges
    const seasons = ["spring", "summer", "autumn", "winter"];
    const seasonLabels = { spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter" };
    const wedgeAngle = Math.PI / 2;

    // Merge "fall" into "autumn"
    const mergedSeasons = { ...seasonData };
    if (mergedSeasons["fall"]) {
      mergedSeasons["autumn"] = (mergedSeasons["autumn"] || 0) + mergedSeasons["fall"];
      delete mergedSeasons["fall"];
    }

    const maxSeasonCount = d3.max(Object.values(mergedSeasons)) || 1;

    for (let i = 0; i < seasons.length; i++) {
      const season = seasons[i];
      const count = mergedSeasons[season] || 0;
      const startAngle = i * wedgeAngle - Math.PI / 2;
      const endAngle = startAngle + wedgeAngle;

      // Wedge fill proportional to count
      const fillR = innerR + (outerR - innerR) * Math.min(1, count / maxSeasonCount);

      const arc = d3.arc()
        .innerRadius(innerR).outerRadius(fillR)
        .startAngle(startAngle + Math.PI / 2).endAngle(endAngle + Math.PI / 2);

      g.append("path").attr("d", arc())
        .attr("transform", `translate(${cx},${cy})`)
        .attr("fill", seasonColor).attr("fill-opacity", 0.2)
        .attr("stroke", seasonColor).attr("stroke-opacity", 0.4).attr("stroke-width", 1);

      // Outline for full wedge
      const arcOutline = d3.arc()
        .innerRadius(innerR).outerRadius(outerR)
        .startAngle(startAngle + Math.PI / 2).endAngle(endAngle + Math.PI / 2);

      g.append("path").attr("d", arcOutline())
        .attr("transform", `translate(${cx},${cy})`)
        .attr("fill", "none")
        .attr("stroke", "var(--border)").attr("stroke-width", 0.5);

      // Season label
      const midAngle = startAngle + wedgeAngle / 2;
      const labelR = outerR + 24;
      g.append("text")
        .attr("x", cx + labelR * Math.cos(midAngle))
        .attr("y", cy + labelR * Math.sin(midAngle))
        .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
        .attr("fill", seasonColor).attr("font-family", "var(--font-mono)")
        .attr("font-size", 11).attr("font-weight", 600)
        .text(seasonLabels[season]);

      // Count inside wedge
      if (count > 0) {
        const countR = innerR + (fillR - innerR) / 2;
        g.append("text")
          .attr("x", cx + countR * Math.cos(midAngle))
          .attr("y", cy + countR * Math.sin(midAngle))
          .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
          .attr("fill", "var(--fg-dim)").attr("font-family", "var(--font-mono)")
          .attr("font-size", 13)
          .text(count);
      }

      // Weather keywords in this season's wedge
      const weatherInSeason = Object.entries(weatherData)
        .filter(([w]) => WEATHER_SEASON[w] === season);

      if (weatherInSeason.length > 0) {
        const weatherStartAngle = startAngle + 0.15;
        const weatherSpread = wedgeAngle - 0.3;

        weatherInSeason.sort((a, b) => b[1] - a[1]);
        const maxW = d3.max(weatherInSeason.map((w) => w[1])) || 1;

        weatherInSeason.forEach(([word, wCount], j) => {
          const wAngle = weatherStartAngle + (j + 0.5) * (weatherSpread / weatherInSeason.length);
          const wR = outerR - 25;
          const wr = d3.scaleSqrt().domain([1, maxW]).range([5, 16])(wCount);

          g.append("circle")
            .attr("cx", cx + wR * Math.cos(wAngle))
            .attr("cy", cy + wR * Math.sin(wAngle))
            .attr("r", wr)
            .attr("fill", weatherColor).attr("fill-opacity", 0.3)
            .attr("stroke", weatherColor).attr("stroke-opacity", 0.5).attr("stroke-width", 0.5);

          const labelR = wr > 7 ? wR : wR + wr + 10;
          g.append("text")
            .attr("x", cx + labelR * Math.cos(wAngle))
            .attr("y", cy + labelR * Math.sin(wAngle))
            .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
            .attr("fill", wr > 7 ? weatherColor : "var(--fg-ghost)")
            .attr("font-family", "var(--font-mono)")
            .attr("font-size", wr > 7 ? 9 : 8)
            .text(word);
        });
      }
    }

    // Center label
    g.append("text").attr("x", cx).attr("y", cy - 6)
      .attr("text-anchor", "middle").attr("fill", "var(--fg-dim)")
      .attr("font-family", "var(--font-mono)").attr("font-size", 12).attr("font-weight", 600)
      .text("seasons");
    g.append("text").attr("x", cx).attr("y", cy + 10)
      .attr("text-anchor", "middle").attr("fill", "var(--fg-ghost)")
      .attr("font-family", "var(--font-mono)").attr("font-size", 10)
      .text("& weather");

  }, [imageryData]);

  // Circle pack — celestial + nature
  useEffect(() => {
    const celestialData = imageryData["celestial"] || {};
    const natureData = imageryData["nature"] || {};
    if (!natureRef.current) return;

    const svg = d3.select(natureRef.current);
    svg.selectAll("*").remove();

    const size = 700;
    svg.attr("width", size).attr("height", size).attr("viewBox", `0 0 ${size} ${size}`);

    const celestialColor = CATEGORY_COLORS["celestial"];
    const natureColor = CATEGORY_COLORS["nature"];

    // Build hierarchy
    const root = d3.hierarchy({
      name: "root",
      children: [
        {
          name: "celestial",
          children: Object.entries(celestialData).map(([word, count]) => ({ name: word, value: count, cat: "celestial" })),
        },
        {
          name: "nature",
          children: Object.entries(natureData).map(([word, count]) => ({ name: word, value: count, cat: "nature" })),
        },
      ],
    }).sum((d) => d.value || 0).sort((a, b) => (b.value || 0) - (a.value || 0));

    d3.pack().size([size - 60, size - 60]).padding(12)(root);

    const g = svg.append("g").attr("transform", "translate(30,30)");

    // Group circles
    root.children?.forEach((group) => {
      const gc = group;
      g.append("circle")
        .attr("cx", gc.x).attr("cy", gc.y).attr("r", gc.r)
        .attr("fill", "none")
        .attr("stroke", gc.data.name === "celestial" ? celestialColor : natureColor)
        .attr("stroke-opacity", 0.15).attr("stroke-width", 1);

      // Group label
      g.append("text")
        .attr("x", gc.x).attr("y", gc.y - gc.r + 16)
        .attr("text-anchor", "middle")
        .attr("fill", gc.data.name === "celestial" ? celestialColor : natureColor)
        .attr("font-family", "var(--font-mono)").attr("font-size", 11).attr("font-weight", 600)
        .attr("fill-opacity", 0.6)
        .text(gc.data.name);
    });

    // Leaf circles
    root.leaves().forEach((leaf) => {
      const color = leaf.parent?.data.name === "celestial" ? celestialColor : natureColor;

      g.append("circle")
        .attr("cx", leaf.x).attr("cy", leaf.y).attr("r", leaf.r)
        .attr("fill", color).attr("fill-opacity", 0.2)
        .attr("stroke", color).attr("stroke-opacity", 0.5).attr("stroke-width", 1);

      if (leaf.r > 16) {
        g.append("text")
          .attr("x", leaf.x).attr("y", leaf.y - 2)
          .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
          .attr("fill", color).attr("font-family", "var(--font-mono)")
          .attr("font-size", Math.min(12, leaf.r * 0.55))
          .text(leaf.data.name);
        g.append("text")
          .attr("x", leaf.x).attr("y", leaf.y + 11)
          .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
          .attr("fill", "var(--fg-ghost)").attr("font-family", "var(--font-mono)")
          .attr("font-size", 9)
          .text(leaf.data.value);
      } else if (leaf.r > 8) {
        g.append("text")
          .attr("x", leaf.x).attr("y", leaf.y)
          .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
          .attr("fill", "var(--fg-ghost)").attr("font-family", "var(--font-mono)")
          .attr("font-size", 9)
          .text(leaf.data.name);
      }
    });

  }, [imageryData]);

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)" }}>
      <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 4 }}>imagery</h1>
      <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-xl)" }}>
        When and where does jazz happen in its own imagination?
      </p>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2xl)" }}>
        <svg ref={clockRef} style={{ maxWidth: "100%" }} />
        <svg ref={seasonRef} style={{ maxWidth: "100%" }} />
        <svg ref={natureRef} style={{ maxWidth: "100%" }} />
      </div>
    </div>
  );
}
