import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { useData } from "../App";
import { getAllTitles, extractPlaces, albumsForTitles } from "../titleAnalysis";
import { useNavigate } from "react-router-dom";
import * as d3 from "d3";

const REGION_MAP = {
  "New York": "US Northeast",
  Harlem: "US Northeast",
  Brooklyn: "US Northeast",
  Broadway: "US Northeast",
  "52nd Street": "US Northeast",
  Village: "US Northeast",
  Boston: "US Northeast",
  Newport: "US Northeast",
  Philadelphia: "US Northeast",
  Montreal: "US Northeast",
  Chicago: "US Midwest",
  Detroit: "US Midwest",
  "St. Louis": "US Midwest",
  Memphis: "US South",
  "New Orleans": "US South",
  Mississippi: "US South",
  "San Francisco": "US West",
  "Los Angeles": "US West",
  Paris: "Europe",
  London: "Europe",
  Berlin: "Europe",
  Vienna: "Europe",
  Stockholm: "Europe",
  Copenhagen: "Europe",
  Amsterdam: "Europe",
  Montreux: "Europe",
  Spain: "Europe",
  Tokyo: "Asia",
  Japan: "Asia",
  India: "Asia",
  Havana: "Latin America & Caribbean",
  Cuba: "Latin America & Caribbean",
  Brazil: "Latin America & Caribbean",
  "Rio de Janeiro": "Latin America & Caribbean",
  Caribbean: "Latin America & Caribbean",
  "Latin America": "Latin America & Caribbean",
  Africa: "Africa & Other",
  Atlantic: "Africa & Other",
  Pacific: "Africa & Other",
};

const REGION_COLORS = {
  "US Northeast": "#5b9bd5",
  "US South": "#d4a843",
  "US Midwest": "#6bb5a0",
  "US West": "#e07b54",
  Europe: "#7c5cbf",
  Asia: "#c75dab",
  "Latin America & Caribbean": "#45a67d",
  "Africa & Other": "#b0884a",
};

export default function WordsGeography() {
  const { albums } = useData();
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const navigate = useNavigate();
  const [activePlace, setActivePlace] = useState(null);

  const { hierarchy, places, regionTotals, titleCount, placeCount } = useMemo(() => {
    const titles = getAllTitles(albums);
    const extracted = extractPlaces(titles);

    // Group by region
    const regionGroups = new Map();
    for (const place of extracted) {
      const region = REGION_MAP[place.label] || "Africa & Other";
      if (!regionGroups.has(region)) regionGroups.set(region, []);
      regionGroups.get(region).push(place);
    }

    const children = [...regionGroups.entries()]
      .map(([region, places]) => ({
        name: region,
        children: places.map((p) => ({
          name: p.label,
          value: p.count,
          region,
          matchedTitles: p.matchedTitles,
        })),
      }))
      .sort((a, b) => {
        const aTotal = a.children.reduce((s, c) => s + c.value, 0);
        const bTotal = b.children.reduce((s, c) => s + c.value, 0);
        return bTotal - aTotal;
      });

    const root = d3
      .hierarchy({ name: "root", children })
      .sum((d) => d.value || 0)
      .sort((a, b) => b.value - a.value);

    // Region totals for legend
    const regionTotals = children.map((c) => ({
      name: c.name,
      total: c.children.reduce((s, ch) => s + ch.value, 0),
    }));

    return { hierarchy: root, places: extracted, regionTotals, titleCount: titles.length, placeCount: extracted.length };
  }, [albums]);

  // Store setter in ref for D3 handlers
  const setActivePlaceRef = useRef(setActivePlace);
  setActivePlaceRef.current = setActivePlace;

  useEffect(() => {
    if (!hierarchy) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 960;
    const height = 540;

    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%").attr("height", height);

    const pack = d3
      .pack()
      .size([width - 40, height - 20])
      .padding((d) => (d.depth === 0 ? 20 : 3));

    const root = pack(hierarchy);
    const tip = d3.select(tooltipRef.current);
    const g = svg.append("g").attr("transform", "translate(20, 10)");

    const regions = root.descendants().filter((d) => d.depth === 1);

    // Region circles — subtle tinted fill, no labels in SVG
    g.selectAll("circle.region")
      .data(regions)
      .join("circle")
      .attr("class", "region")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", (d) => d.r)
      .attr("fill", (d) => REGION_COLORS[d.data.name])
      .attr("fill-opacity", 0.04)
      .attr("stroke", (d) => REGION_COLORS[d.data.name])
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.1);

    // Place circles (depth 2)
    const placeNodes = root.leaves();

    const placeGroups = g
      .selectAll("g.place")
      .data(placeNodes)
      .join("g")
      .attr("class", "place")
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .style("cursor", "pointer");

    placeGroups
      .append("circle")
      .attr("r", (d) => d.r)
      .attr("fill", (d) => REGION_COLORS[d.data.region])
      .attr("fill-opacity", 0.2)
      .attr("stroke", (d) => REGION_COLORS[d.data.region])
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.5);

    // Place name labels
    placeGroups
      .filter((d) => d.r > 16)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => (d.r > 26 ? "-0.2em" : "0.35em"))
      .attr("fill", "var(--fg)")
      .attr("font-family", "var(--font-mono)")
      .attr("font-size", (d) => Math.min(11, d.r * 0.42))
      .attr("pointer-events", "none")
      .text((d) => d.data.name);

    // Count below name for bigger circles
    placeGroups
      .filter((d) => d.r > 26)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1em")
      .attr("y", 4)
      .attr("fill", "var(--fg-ghost)")
      .attr("font-family", "var(--font-mono)")
      .attr("font-size", 9)
      .attr("pointer-events", "none")
      .text((d) => d.data.value);

    // Hover
    placeGroups
      .on("mouseenter", function (event, d) {
        d3.select(this).select("circle").attr("fill-opacity", 0.4).attr("stroke-opacity", 1);
        tip
          .style("display", "block")
          .style("left", `${event.offsetX + 14}px`)
          .style("top", `${event.offsetY - 24}px`)
          .html(
            `<strong>${d.data.name}</strong><br/>` +
              `<span style="color:${REGION_COLORS[d.data.region]}">${d.data.region}</span><br/>` +
              `<span style="color:var(--fg-dim)">${d.data.value} mention${d.data.value !== 1 ? "s" : ""}</span>`,
          );
      })
      .on("mouseleave", function () {
        d3.select(this).select("circle").attr("fill-opacity", 0.2).attr("stroke-opacity", 0.5);
        tip.style("display", "none");
      })
      .on("click", (event, d) => {
        setActivePlaceRef.current((prev) =>
          prev?.name === d.data.name
            ? null
            : { name: d.data.name, region: d.data.region, count: d.data.value, matchedTitles: d.data.matchedTitles },
        );
      });
  }, [hierarchy]);

  // Albums for the clicked place
  const linkedAlbums = useMemo(() => {
    if (!activePlace) return null;
    return albumsForTitles(albums, activePlace.matchedTitles);
  }, [activePlace, albums]);

  const handleAlbumClick = useCallback(
    (album) => navigate(`/album/${album.id}`),
    [navigate],
  );

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)" }}>
      <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 4 }}>Geography</h1>
      <p
        className="mono"
        style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}
      >
        Where jazz dreams of — {placeCount} places extracted from{" "}
        {titleCount.toLocaleString()} song and album titles
      </p>

      {placeCount === 0 ? (
        <p
          className="mono"
          style={{ color: "var(--fg-muted)", textAlign: "center", padding: 60 }}
        >
          No place data found
        </p>
      ) : (
        <>
          <div style={{ position: "relative", overflowX: "auto" }}>
            <svg ref={svgRef} />
            <div
              ref={tooltipRef}
              style={{
                display: "none",
                position: "absolute",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                color: "var(--fg)",
                pointerEvents: "none",
                zIndex: 10,
                whiteSpace: "nowrap",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px 16px",
              marginTop: 8,
              justifyContent: "center",
            }}
          >
            {regionTotals.map((r) => (
              <span
                key={r.name}
                className="mono"
                style={{ fontSize: 10, color: REGION_COLORS[r.name], whiteSpace: "nowrap" }}
              >
                {r.name} ({r.total})
              </span>
            ))}
          </div>
        </>
      )}

      {activePlace && linkedAlbums && (
        <div
          style={{
            marginTop: "var(--space-xl)",
            borderTop: "1px solid var(--border)",
            paddingTop: "var(--space-lg)",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: "var(--space-md)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 300, margin: 0 }}>{activePlace.name}</h2>
            <span className="mono" style={{ fontSize: 11, color: REGION_COLORS[activePlace.region] }}>
              {activePlace.region}
            </span>
            <span className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)" }}>
              {linkedAlbums.length} albums
            </span>
            <button
              onClick={() => setActivePlace(null)}
              className="mono"
              style={{
                fontSize: 10,
                color: "var(--fg-muted)",
                cursor: "pointer",
                marginLeft: "auto",
              }}
            >
              close
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 8,
            }}
          >
            {linkedAlbums.slice(0, 60).map((a) => (
              <div
                key={a.id}
                onClick={() => handleAlbumClick(a)}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "8px 10px",
                  background: "var(--surface)",
                  borderRadius: 4,
                  cursor: "pointer",
                  transition: "var(--ease-default)",
                  alignItems: "center",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--border)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
              >
                {a.coverPath && (
                  <img
                    src={`/data/${a.coverPath}`}
                    alt=""
                    style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 2, flexShrink: 0 }}
                    loading="lazy"
                  />
                )}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--fg)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {a.title}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--fg-ghost)" }}>
                    {a.artist} · {a.year}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {linkedAlbums.length > 60 && (
            <p className="mono" style={{ fontSize: 10, color: "var(--fg-ghost)", marginTop: 8 }}>
              showing 60 of {linkedAlbums.length}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
