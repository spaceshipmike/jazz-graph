import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { useData } from "../App";
import { instrumentFamily, familyColor } from "../data";
import { useNavigate } from "react-router-dom";
import * as d3 from "d3";
import { sankey as d3Sankey, sankeyLinkHorizontal } from "d3-sankey";

const MIN_ALBUMS = 8;

export default function SoundCombos() {
  const { albums } = useData();
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const navigate = useNavigate();
  const [activeLink, setActiveLink] = useState(null);

  // Build sankey data: lead instruments → sideman instruments
  const { graph, albumMap } = useMemo(() => {
    const pairCounts = new Map();
    const pairAlbums = new Map();

    for (const a of albums) {
      const lineup = a.lineup || [];
      const leadInsts = [...new Set(lineup.filter((m) => m.lead).map((m) => m.instrument))];
      const sideInsts = [...new Set(lineup.filter((m) => !m.lead).map((m) => m.instrument))];
      if (leadInsts.length === 0) continue;

      for (const li of leadInsts) {
        if (li === "unknown") continue;
        for (const si of sideInsts) {
          if (si === li || si === "unknown") continue;
          const key = `${li}|${si}`;
          pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
          if (!pairAlbums.has(key)) pairAlbums.set(key, []);
          pairAlbums.get(key).push(a);
        }
      }
    }

    const significant = [...pairCounts.entries()]
      .filter(([, count]) => count >= MIN_ALBUMS)
      .sort((a, b) => b[1] - a[1]);

    const leadSet = new Set();
    const sideSet = new Set();
    for (const [key] of significant) {
      const [lead, side] = key.split("|");
      leadSet.add(lead);
      sideSet.add(side);
    }

    const nodes = [];
    const nodeIndex = new Map();

    for (const inst of leadSet) {
      const id = `lead-${inst}`;
      nodeIndex.set(id, nodes.length);
      nodes.push({ id, name: inst, side: "lead", family: instrumentFamily(inst) });
    }
    for (const inst of sideSet) {
      const id = `side-${inst}`;
      nodeIndex.set(id, nodes.length);
      nodes.push({ id, name: inst, side: "side", family: instrumentFamily(inst) });
    }

    const links = [];
    for (const [key, count] of significant) {
      const [lead, side] = key.split("|");
      const sourceId = `lead-${lead}`;
      const targetId = `side-${side}`;
      if (nodeIndex.has(sourceId) && nodeIndex.has(targetId)) {
        links.push({ source: sourceId, target: targetId, value: count, lead, side, key });
      }
    }

    return { graph: { nodes, links }, albumMap: pairAlbums };
  }, [albums]);

  // Store setActiveLink in a ref so D3 handlers can access it without stale closures
  const setActiveLinkRef = useRef(setActiveLink);
  setActiveLinkRef.current = setActiveLink;

  // Draw sankey — runs once when graph data changes
  useEffect(() => {
    if (!graph.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 160, bottom: 20, left: 160 };
    const width = 900;
    const height = Math.max(500, graph.nodes.length * 18);

    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%").attr("height", height);

    const sankeyGen = d3Sankey()
      .nodeId((d) => d.id)
      .nodeWidth(14)
      .nodePadding(8)
      .nodeSort((a, b) => {
        const fa = a.family || "zzz";
        const fb = b.family || "zzz";
        if (fa !== fb) return fa.localeCompare(fb);
        return (b.value || 0) - (a.value || 0);
      })
      .extent([
        [margin.left, margin.top],
        [width - margin.right, height - margin.bottom],
      ]);

    const { nodes, links } = sankeyGen({
      nodes: graph.nodes.map((d) => ({ ...d })),
      links: graph.links.map((d) => ({ ...d })),
    });

    const g = svg.append("g");
    const linkPath = sankeyLinkHorizontal();
    const tip = d3.select(tooltipRef.current);

    // Links
    const linkSel = g
      .append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("class", "sankey-link")
      .attr("d", linkPath)
      .attr("fill", "none")
      .attr("stroke", (d) => familyColor(d.source.family))
      .attr("stroke-opacity", 0.25)
      .attr("stroke-width", (d) => Math.max(1, d.width))
      .style("cursor", "pointer")
      .style("mix-blend-mode", "screen")
      .on("mouseenter", function (event, d) {
        d3.select(this).attr("stroke-opacity", 0.65);
        tip
          .style("display", "block")
          .style("left", `${event.offsetX + 12}px`)
          .style("top", `${event.offsetY - 20}px`)
          .html(
            `<strong>${d.source.name}</strong> + <strong>${d.target.name}</strong><br/>` +
              `<span style="color:var(--fg-dim)">${d.value} albums</span>`,
          );
      })
      .on("mouseleave", function () {
        d3.select(this).attr("stroke-opacity", 0.25);
        tip.style("display", "none");
      })
      .on("click", (event, d) => {
        setActiveLinkRef.current((prev) =>
          prev?.key === d.key ? null : { key: d.key, lead: d.lead, side: d.side, count: d.value },
        );
      });

    // Nodes
    g.append("g")
      .selectAll("rect")
      .data(nodes)
      .join("rect")
      .attr("x", (d) => d.x0)
      .attr("y", (d) => d.y0)
      .attr("width", (d) => d.x1 - d.x0)
      .attr("height", (d) => Math.max(1, d.y1 - d.y0))
      .attr("fill", (d) => familyColor(d.family))
      .attr("opacity", 0.85)
      .attr("rx", 2)
      .style("cursor", "pointer")
      .on("mouseenter", function (event, d) {
        // Dim unrelated links, highlight connected ones
        linkSel.attr("stroke-opacity", (l) =>
          l.source.name === d.name || l.target.name === d.name ? 0.55 : 0.04,
        );
        tip
          .style("display", "block")
          .style("left", `${event.offsetX + 12}px`)
          .style("top", `${event.offsetY - 20}px`)
          .html(`<strong>${d.name}</strong> <span style="color:var(--fg-dim)">(${d.side})</span>`);
      })
      .on("mouseleave", function () {
        linkSel.attr("stroke-opacity", 0.25);
        tip.style("display", "none");
      });

    // Node labels
    g.append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .attr("x", (d) => (d.side === "lead" ? d.x0 - 8 : d.x1 + 8))
      .attr("y", (d) => (d.y0 + d.y1) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (d) => (d.side === "lead" ? "end" : "start"))
      .attr("fill", "var(--fg-dim)")
      .attr("font-family", "var(--font-mono)")
      .attr("font-size", 10)
      .text((d) => d.name)
      .style("pointer-events", "none");
  }, [graph]);

  // Albums for clicked link
  const linkedAlbums = useMemo(() => {
    if (!activeLink) return null;
    const list = albumMap.get(activeLink.key) || [];
    return [...list].sort((a, b) => (a.year || 0) - (b.year || 0));
  }, [activeLink, albumMap]);

  const handleAlbumClick = useCallback(
    (album) => navigate(`/album/${album.id}`),
    [navigate],
  );

  // Stats
  const stats = useMemo(() => {
    const leadCounts = new Map();
    for (const a of albums) {
      for (const m of a.lineup || []) {
        if (m.lead && m.instrument !== "unknown") {
          leadCounts.set(m.instrument, (leadCounts.get(m.instrument) || 0) + 1);
        }
      }
    }
    const topLead = [...leadCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      uniqueLeads: leadCounts.size,
      topLead: topLead ? topLead[0] : "",
      topLeadCount: topLead ? topLead[1] : 0,
    };
  }, [albums]);

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)" }}>
      <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 4 }}>Instrument Combos</h1>
      <p
        className="mono"
        style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}
      >
        When {stats.topLead} leads ({stats.topLeadCount} albums), what does the band look like?
        Hover a node to highlight its connections. Click a ribbon for albums.
      </p>

      {graph.nodes.length === 0 ? (
        <p
          className="mono"
          style={{ color: "var(--fg-muted)", textAlign: "center", padding: 60 }}
        >
          No lineup data available
        </p>
      ) : (
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
      )}

      {activeLink && linkedAlbums && (
        <div
          style={{
            marginTop: "var(--space-xl)",
            borderTop: "1px solid var(--border)",
            paddingTop: "var(--space-lg)",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: "var(--space-md)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 300, margin: 0 }}>
              {activeLink.lead} + {activeLink.side}
            </h2>
            <span className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)" }}>
              {activeLink.count} albums
            </span>
            <button
              onClick={() => setActiveLink(null)}
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
