import { useMemo, useRef, useEffect, useState } from "react";
import { useData } from "../App";
import { labelColor } from "../data";
import * as d3 from "d3";

const PERIODS = [
  { label: "1949–55", min: 1949, max: 1955 },
  { label: "1956–60", min: 1956, max: 1960 },
  { label: "1961–65", min: 1961, max: 1965 },
  { label: "1966–70", min: 1966, max: 1970 },
  { label: "1971–75", min: 1971, max: 1975 },
  { label: "1976–80", min: 1976, max: 1980 },
  { label: "1981+",   min: 1981, max: 2010 },
];

function buildFlowData(albums) {
  // For each musician, track labels per period
  const musicianPeriods = new Map();
  for (const album of albums) {
    const pIdx = PERIODS.findIndex((p) => album.year >= p.min && album.year <= p.max);
    if (pIdx < 0) continue;
    for (const m of album.lineup) {
      if (!musicianPeriods.has(m.name)) musicianPeriods.set(m.name, new Map());
      const periods = musicianPeriods.get(m.name);
      if (!periods.has(pIdx)) periods.set(pIdx, new Set());
      periods.get(pIdx).add(album.label || "Other");
    }
  }

  // Build nodes: label × period
  const nodeMap = new Map(); // "period:label" → node
  const nodes = [];
  const flows = []; // { source, target, musicians: string[], value }

  function getNode(pIdx, label) {
    const key = `${pIdx}:${label}`;
    if (!nodeMap.has(key)) {
      const node = { id: key, period: pIdx, label, value: 0, musicians: new Set() };
      nodeMap.set(key, node);
      nodes.push(node);
    }
    return nodeMap.get(key);
  }

  // Count musician appearances per node
  for (const [name, periods] of musicianPeriods) {
    for (const [pIdx, labels] of periods) {
      for (const label of labels) {
        const node = getNode(pIdx, label);
        node.value++;
        node.musicians.add(name);
      }
    }
  }

  // Build flows between consecutive periods
  const flowMap = new Map(); // "sourceKey→targetKey" → { musicians, value }
  for (const [name, periods] of musicianPeriods) {
    const sortedPeriods = [...periods.keys()].sort((a, b) => a - b);
    for (let i = 0; i < sortedPeriods.length - 1; i++) {
      const p1 = sortedPeriods[i];
      const p2 = sortedPeriods[i + 1];
      for (const l1 of periods.get(p1)) {
        for (const l2 of periods.get(p2)) {
          const key = `${p1}:${l1}→${p2}:${l2}`;
          if (!flowMap.has(key)) flowMap.set(key, { source: `${p1}:${l1}`, target: `${p2}:${l2}`, musicians: [], value: 0 });
          const flow = flowMap.get(key);
          flow.musicians.push(name);
          flow.value++;
        }
      }
    }
  }

  return { nodes: nodes.filter((n) => n.value > 0), flows: [...flowMap.values()].filter((f) => f.value > 0), nodeMap };
}

export default function Flow() {
  const { albums } = useData();
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 1000, h: 600 });
  const [hover, setHover] = useState(null);

  const { nodes, flows, nodeMap } = useMemo(() => buildFlowData(albums), [albums]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width } = entry.contentRect;
      setDims({ w: width, h: Math.min(600, Math.max(400, width * 0.55)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // D3 render
  useEffect(() => {
    if (!nodes.length || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 30, right: 20, bottom: 20, left: 20 };
    const w = dims.w - margin.left - margin.right;
    const h = dims.h - margin.top - margin.bottom;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const colW = 50;
    const gap = (w - colW * PERIODS.length) / (PERIODS.length - 1);

    // Layout nodes per column
    const columns = PERIODS.map((_, i) => {
      const colNodes = nodes.filter((n) => n.period === i).sort((a, b) => b.value - a.value);
      return colNodes;
    });

    const maxColTotal = d3.max(columns, (col) => d3.sum(col, (n) => n.value)) || 1;
    const yScale = h / (maxColTotal + columns.reduce((max, col) => Math.max(max, col.length), 0) * 2);

    // Position nodes
    const nodePositions = new Map();
    for (let ci = 0; ci < columns.length; ci++) {
      const col = columns[ci];
      const x = ci * (colW + gap);
      let yOffset = 0;
      for (const node of col) {
        const nh = Math.max(4, node.value * yScale);
        nodePositions.set(node.id, { x, y: yOffset, w: colW, h: nh, node });
        yOffset += nh + 3;
      }
    }

    // Draw flows (ribbons)
    const flowGroup = g.append("g");
    for (const flow of flows) {
      const sp = nodePositions.get(flow.source);
      const tp = nodePositions.get(flow.target);
      if (!sp || !tp) continue;

      const srcNode = nodeMap.get(flow.source);
      const tgtNode = nodeMap.get(flow.target);
      const srcFrac = flow.value / (srcNode?.value || 1);
      const tgtFrac = flow.value / (tgtNode?.value || 1);

      const sy0 = sp.y + sp.h * 0.2;
      const sy1 = sy0 + sp.h * srcFrac * 0.6;
      const ty0 = tp.y + tp.h * 0.2;
      const ty1 = ty0 + tp.h * tgtFrac * 0.6;

      const cx1 = sp.x + sp.w + gap * 0.4;
      const cx2 = tp.x - gap * 0.4;

      const path = d3.path();
      path.moveTo(sp.x + sp.w, sy0);
      path.bezierCurveTo(cx1, sy0, cx2, ty0, tp.x, ty0);
      path.lineTo(tp.x, ty1);
      path.bezierCurveTo(cx2, ty1, cx1, sy1, sp.x + sp.w, sy1);
      path.closePath();

      const srcLabel = srcNode?.label || "Other";
      flowGroup.append("path")
        .attr("d", path.toString())
        .attr("fill", labelColor(srcLabel))
        .attr("opacity", 0.15)
        .attr("stroke", "none")
        .style("cursor", "pointer")
        .on("mouseenter", function (event) {
          d3.select(this).attr("opacity", 0.5);
          const names = flow.musicians.slice(0, 8);
          setHover({
            type: "flow",
            from: srcLabel,
            to: tgtNode?.label || "Other",
            musicians: names,
            total: flow.musicians.length,
            x: event.clientX,
            y: event.clientY,
          });
        })
        .on("mouseleave", function () {
          d3.select(this).attr("opacity", 0.15);
          setHover(null);
        });
    }

    // Draw nodes (rectangles)
    for (const [id, pos] of nodePositions) {
      const label = pos.node.label;
      g.append("rect")
        .attr("x", pos.x)
        .attr("y", pos.y)
        .attr("width", pos.w)
        .attr("height", pos.h)
        .attr("rx", 2)
        .attr("fill", labelColor(label))
        .attr("opacity", 0.85)
        .style("cursor", "pointer")
        .on("mouseenter", (event) => {
          const topMusicians = [...pos.node.musicians].slice(0, 6);
          setHover({
            type: "node",
            label,
            count: pos.node.value,
            musicians: topMusicians,
            x: event.clientX,
            y: event.clientY,
          });
        })
        .on("mouseleave", () => setHover(null));

      // Label text for larger nodes
      if (pos.h > 14) {
        g.append("text")
          .attr("x", pos.x + pos.w / 2)
          .attr("y", pos.y + pos.h / 2)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .attr("fill", "#fff")
          .attr("font-family", "var(--font-mono)")
          .attr("font-size", Math.min(9, pos.h - 4))
          .attr("pointer-events", "none")
          .text(label.length > 8 ? label.slice(0, 7) + "…" : label);
      }
    }

    // Period labels
    for (let i = 0; i < PERIODS.length; i++) {
      const x = i * (colW + gap) + colW / 2;
      g.append("text")
        .attr("x", x)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .attr("fill", "#555")
        .attr("font-family", "var(--font-mono)")
        .attr("font-size", 10)
        .text(PERIODS[i].label);
    }
  }, [nodes, flows, nodeMap, dims]);

  return (
    <div style={{ padding: "var(--space-xl)", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, marginBottom: 4 }}>
          Label Flow
        </h2>
        <p className="mono" style={{ color: "var(--fg-muted)", fontSize: 11 }}>
          How musicians moved between record labels across decades. Hover ribbons to see who made the journey.
        </p>
      </div>

      <div ref={containerRef} style={{ width: "100%", position: "relative" }}>
        <svg ref={svgRef} width={dims.w} height={dims.h} />

        {hover && (
          <div
            className="mono"
            style={{
              position: "fixed",
              left: hover.x + 12,
              top: hover.y - 40,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "8px 12px",
              fontSize: 11,
              color: "var(--fg)",
              pointerEvents: "none",
              zIndex: 10,
              maxWidth: 260,
            }}
          >
            {hover.type === "node" ? (
              <>
                <div style={{ color: labelColor(hover.label), fontWeight: 600, marginBottom: 2 }}>{hover.label}</div>
                <div style={{ color: "var(--fg-dim)" }}>{hover.count} musician appearances</div>
                <div style={{ color: "var(--fg-muted)", marginTop: 4 }}>{hover.musicians.join(", ")}</div>
              </>
            ) : (
              <>
                <div>
                  <span style={{ color: labelColor(hover.from), fontWeight: 600 }}>{hover.from}</span>
                  {" → "}
                  <span style={{ color: labelColor(hover.to), fontWeight: 600 }}>{hover.to}</span>
                </div>
                <div style={{ color: "var(--fg-dim)", marginTop: 2 }}>{hover.total} musician{hover.total !== 1 ? "s" : ""}</div>
                <div style={{ color: "var(--fg-muted)", marginTop: 4 }}>{hover.musicians.join(", ")}{hover.total > 8 ? "…" : ""}</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
