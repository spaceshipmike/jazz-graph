import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../App";
import { instrumentColor, slugify } from "../data";
import { louvain } from "../community";
import * as d3 from "d3";

const MIN_ALBUMS = 4; // minimum albums to appear as a node
const MIN_SHARED = 2; // minimum shared albums to draw an edge

// Vivid palette for the largest scenes; remaining scenes fall back to gray.
const SCENE_PALETTE = [
  "#ff6b6b", "#ffd166", "#06d6a0", "#4cc9f0", "#b8a4ff", "#ff9f1c",
  "#f15bb5", "#80ed99", "#00bbf9", "#fee440", "#e07a5f", "#9bf6ff",
];
const SCENE_GRAY = "#4a4a52";

export default function Network() {
  const { albums, index } = useData();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const simRef = useRef(null);
  const nodesRef = useRef([]);
  const linksRef = useRef([]);
  const transformRef = useRef(d3.zoomIdentity);
  const hoverRef = useRef(null);
  const [dims, setDims] = useState({ w: 900, h: 600 });
  const [tip, setTip] = useState(null);
  const [colorMode, setColorMode] = useState("scene"); // "scene" | "instrument"
  const [instFilter, setInstFilter] = useState(null);
  const [commFilter, setCommFilter] = useState(null);
  const [resolution, setResolution] = useState(1); // committed Louvain granularity (drives recompute)
  const [resInput, setResInput] = useState(1); // live slider value (display only)
  const resTimer = useRef(null);

  // Debounce the slider: show the value instantly, recompute scenes once dragging settles.
  const onResolution = useCallback((v) => {
    setResInput(v);
    if (resTimer.current) clearTimeout(resTimer.current);
    resTimer.current = setTimeout(() => {
      setResolution(v);
      setCommFilter(null);
    }, 280);
  }, []);
  useEffect(() => () => { if (resTimer.current) clearTimeout(resTimer.current); }, []);

  // Build musician-to-musician collaboration graph
  const { nodes, links, instruments, scenes } = useMemo(() => {
    if (!index) return { nodes: [], links: [], instruments: [], scenes: [] };

    const musicians = index.musicians.filter((m) => m.albums.length >= MIN_ALBUMS && m.primary !== "unknown");
    const nameToIdx = new Map();
    musicians.forEach((m, i) => nameToIdx.set(m.name, i));

    // Build co-appearance edges
    const edgeMap = new Map();
    for (const album of albums) {
      const members = album.lineup
        .map((m) => m.name)
        .filter((n) => nameToIdx.has(n));
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const key = [members[i], members[j]].sort().join("|||");
          edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
        }
      }
    }

    const links = [];
    for (const [key, weight] of edgeMap) {
      if (weight < MIN_SHARED) continue;
      const [a, b] = key.split("|||");
      links.push({ source: nameToIdx.get(a), target: nameToIdx.get(b), weight });
    }

    // Only keep musicians that have at least one edge
    const connected = new Set();
    for (const l of links) {
      connected.add(l.source);
      connected.add(l.target);
    }

    const oldToNew = new Map();
    const nodes = [];
    musicians.forEach((m, i) => {
      if (!connected.has(i)) return;
      oldToNew.set(i, nodes.length);
      nodes.push({
        idx: nodes.length,
        name: m.name,
        slug: m.slug || slugify(m.name),
        primary: m.primary,
        instruments: m.instruments,
        albumCount: m.albums.length,
        r: 3 + Math.sqrt(m.albums.length) * 2.5,
      });
    });

    const remapped = links
      .filter((l) => oldToNew.has(l.source) && oldToNew.has(l.target))
      .map((l) => ({
        source: oldToNew.get(l.source),
        target: oldToNew.get(l.target),
        weight: l.weight,
      }));

    // Detect scenes (communities) via weighted Louvain.
    const comm = louvain(nodes.length, remapped, { resolution });
    nodes.forEach((n, i) => { n.community = comm[i]; });

    // Aggregate per-community stats: size + most prolific member (the namesake).
    const sceneMap = new Map();
    for (const n of nodes) {
      let s = sceneMap.get(n.community);
      if (!s) {
        s = { id: n.community, size: 0, lead: null };
        sceneMap.set(n.community, s);
      }
      s.size += 1;
      if (!s.lead || n.albumCount > s.lead.albumCount) s.lead = n;
    }

    // Rank scenes by size; top ones get vivid colors + names, rest go gray.
    const scenes = [...sceneMap.values()].sort((a, b) => b.size - a.size);
    scenes.forEach((s, rank) => {
      s.rank = rank;
      s.color = rank < SCENE_PALETTE.length ? SCENE_PALETTE[rank] : SCENE_GRAY;
      // Named after its anchor (most prolific) musician; "scene" is the noun.
      s.name = s.lead ? s.lead.name.split(" ").slice(-1)[0] : `Scene ${s.id}`;
      s.fullName = s.lead ? s.lead.name : `Scene ${s.id}`;
    });

    const sceneColor = new Map(scenes.map((s) => [s.id, s.color]));
    nodes.forEach((n) => { n.sceneColor = sceneColor.get(n.community) || SCENE_GRAY; });

    const instSet = new Set();
    nodes.forEach((n) => instSet.add(n.primary));

    return {
      nodes,
      links: remapped,
      instruments: [...instSet].sort(),
      scenes,
    };
  }, [albums, index, resolution]);

  // Color resolver per node, by current mode.
  const nodeColor = useCallback(
    (n) => (colorMode === "scene" ? n.sceneColor : instrumentColor(n.primary)),
    [colorMode]
  );

  // Whether a node passes the active filter (instrument or scene).
  const passesFilter = useCallback(
    (n) => {
      if (colorMode === "scene") return !commFilter || n.community === commFilter;
      return !instFilter || n.primary === instFilter;
    },
    [colorMode, commFilter, instFilter]
  );

  // Resize
  useEffect(() => {
    const update = () => setDims({
      w: Math.min(window.innerWidth - 64, 1600),
      h: Math.min(window.innerHeight - 220, 800),
    });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = dims;

    ctx.save();
    ctx.clearRect(0, 0, w * dpr, h * dpr);
    ctx.scale(dpr, dpr);

    const t = transformRef.current;
    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);

    const hovered = hoverRef.current;
    const hoveredConns = new Set();
    if (hovered != null) {
      for (const l of linksRef.current) {
        const si = typeof l.source === "object" ? l.source.idx : l.source;
        const ti = typeof l.target === "object" ? l.target.idx : l.target;
        if (si === hovered) hoveredConns.add(ti);
        if (ti === hovered) hoveredConns.add(si);
      }
    }

    const sceneMode = colorMode === "scene";

    // Links
    for (const l of linksRef.current) {
      const s = typeof l.source === "object" ? l.source : nodesRef.current[l.source];
      const tgt = typeof l.target === "object" ? l.target : nodesRef.current[l.target];
      if (!s || !tgt) continue;

      const sn = nodesRef.current[s.idx];
      const tn = nodesRef.current[tgt.idx];
      const matchFilter = passesFilter(sn) || passesFilter(tn);
      const isHoverLink = hovered != null && (s.idx === hovered || tgt.idx === hovered);
      const sameScene = sceneMode && sn.community === tn.community;

      if (hovered != null && !isHoverLink) {
        ctx.globalAlpha = 0.03;
        ctx.strokeStyle = "#1a1a1e";
      } else if (!matchFilter) {
        ctx.globalAlpha = 0.03;
        ctx.strokeStyle = "#1a1a1e";
      } else if (isHoverLink) {
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = nodeColor(nodesRef.current[s.idx === hovered ? tgt.idx : s.idx]);
      } else if (sameScene) {
        // Intra-scene edges tinted with the scene color so clusters cohere.
        ctx.globalAlpha = Math.min(0.12 + l.weight * 0.05, 0.4);
        ctx.strokeStyle = sn.sceneColor;
      } else {
        ctx.globalAlpha = Math.min(0.08 + l.weight * 0.04, 0.3);
        ctx.strokeStyle = "#2a2a2e";
      }

      ctx.lineWidth = Math.min(0.5 + l.weight * 0.3, 3);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.stroke();
    }

    // Nodes
    for (const n of nodesRef.current) {
      const matchFilter = passesFilter(n);
      const isHovered = hovered === n.idx;
      const isConn = hovered != null && hoveredConns.has(n.idx);
      const isDimmed = hovered != null && !isHovered && !isConn;

      ctx.globalAlpha = isDimmed ? 0.06 : !matchFilter ? 0.1 : isHovered ? 1 : isConn ? 0.9 : 0.75;
      ctx.fillStyle = nodeColor(n);

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();

      if (isHovered || isConn) {
        ctx.strokeStyle = nodeColor(n);
        ctx.lineWidth = isHovered ? 2 : 1;
        ctx.globalAlpha = isHovered ? 1 : 0.5;
        ctx.stroke();
      }
    }

    // Scene name labels at cluster centroids (scene mode, when not hovering)
    if (sceneMode && hovered == null) {
      const centroids = new Map(); // community -> { x, y, n, color, name }
      for (const n of nodesRef.current) {
        const meta = nodes[n.idx];
        let c = centroids.get(meta.community);
        if (!c) {
          const scene = scenes.find((s) => s.id === meta.community);
          if (!scene || scene.rank >= SCENE_PALETTE.length || scene.size < 4) continue;
          c = { x: 0, y: 0, n: 0, color: scene.color, name: scene.name };
          centroids.set(meta.community, c);
        }
        c.x += n.x; c.y += n.y; c.n += 1;
      }
      ctx.textAlign = "center";
      ctx.font = "300 16px 'Oswald', sans-serif";
      for (const c of centroids.values()) {
        const cx = c.x / c.n, cy = c.y / c.n;
        ctx.globalAlpha = 0.92;
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = "#0c0c0e";
        ctx.strokeText(c.name, cx, cy);
        ctx.fillStyle = c.color;
        ctx.fillText(c.name, cx, cy);
      }
    }

    // Labels for hovered + connections
    if (hovered != null) {
      ctx.globalAlpha = 1;
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";

      const h_node = nodesRef.current[hovered];
      if (h_node) {
        ctx.fillStyle = "#e8e4dc";
        ctx.fillText(h_node.name, h_node.x, h_node.y - h_node.r - 6);
      }

      ctx.fillStyle = "#888";
      for (const ci of hoveredConns) {
        const cn = nodesRef.current[ci];
        if (cn && cn.r > 4) {
          ctx.fillText(cn.name, cn.x, cn.y - cn.r - 4);
        }
      }
    }

    ctx.restore();
  }, [dims, colorMode, nodeColor, passesFilter, nodes, scenes]);

  // Simulation
  useEffect(() => {
    if (!nodes.length) return;
    const { w, h } = dims;

    nodesRef.current = nodes.map((n) => ({ ...n }));
    linksRef.current = links.map((l) => ({ ...l }));

    const sim = d3.forceSimulation(nodesRef.current)
      .force("link", d3.forceLink(linksRef.current)
        .id((d) => d.idx)
        .distance((d) => 40 / Math.sqrt(d.weight))
        .strength((d) => Math.min(0.1 + d.weight * 0.03, 0.5)))
      .force("charge", d3.forceManyBody()
        .strength((d) => -30 - d.albumCount * 2))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .force("collision", d3.forceCollide().radius((d) => d.r + 1.5))
      .force("x", d3.forceX(w / 2).strength(0.03))
      .force("y", d3.forceY(h / 2).strength(0.03))
      .alphaDecay(0.02)
      .on("tick", draw);

    simRef.current = sim;
    return () => sim.stop();
  }, [nodes, links, dims, draw]);

  // Redraw on filter/mode change
  useEffect(() => { draw(); }, [instFilter, commFilter, colorMode, draw]);

  // Canvas interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function hitTest(px, py) {
      const t = transformRef.current;
      const x = (px - t.x) / t.k;
      const y = (py - t.y) / t.k;
      for (let i = nodesRef.current.length - 1; i >= 0; i--) {
        const n = nodesRef.current[i];
        const dx = n.x - x, dy = n.y - y;
        if (dx * dx + dy * dy < (n.r + 3) * (n.r + 3)) return n;
      }
      return null;
    }

    // Zoom
    const zoom = d3.zoom()
      .scaleExtent([0.2, 6])
      .on("zoom", (e) => {
        transformRef.current = e.transform;
        draw();
      });

    d3.select(canvas).call(zoom);

    // Hover
    function onMove(e) {
      const rect = canvas.getBoundingClientRect();
      const px = (e.clientX - rect.left);
      const py = (e.clientY - rect.top);
      const hit = hitTest(px, py);
      const newHover = hit ? hit.idx : null;
      if (newHover !== hoverRef.current) {
        hoverRef.current = newHover;
        draw();
        if (hit) {
          const meta = nodes[hit.idx];
          const scene = scenes.find((s) => s.id === meta.community);
          setTip({
            x: e.clientX,
            y: e.clientY,
            text: `${hit.name}\n${hit.instruments.join(", ")}\n${hit.albumCount} albums${scene ? `\n— ${scene.fullName} scene` : ""}`,
          });
          canvas.style.cursor = "pointer";
        } else {
          setTip(null);
          canvas.style.cursor = "grab";
        }
      } else if (hit && tip) {
        setTip({ x: e.clientX, y: e.clientY, text: tip.text });
      }
    }

    function onClick(e) {
      const rect = canvas.getBoundingClientRect();
      const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (hit) navigate(`/artist/${hit.slug}`);
    }

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("mouseleave", () => {
      hoverRef.current = null;
      setTip(null);
      draw();
    });

    return () => {
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("click", onClick);
    };
  }, [draw, navigate, tip, nodes, scenes]);

  // Set canvas resolution
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dims.w * dpr;
    canvas.height = dims.h * dpr;
    draw();
  }, [dims, draw]);

  const namedScenes = scenes.filter((s) => s.rank < SCENE_PALETTE.length);

  return (
    <div style={{ padding: "var(--space-md) var(--space-xl)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-sm)" }}>
        <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 4 }}>Collaboration Network</h1>
        <span className="mono" style={{ fontSize: 10, color: "var(--fg-ghost)" }}>
          {nodes.length} musicians · {links.length} connections · {scenes.length} scenes
        </span>
      </div>

      {/* Color mode toggle + scene granularity */}
      <div className="mono" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px 16px", fontSize: 10, marginBottom: "var(--space-sm)" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            ["scene", "scenes"],
            ["instrument", "instrument"],
          ].map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => { setColorMode(mode); setInstFilter(null); setCommFilter(null); }}
              style={{
                cursor: "pointer",
                background: colorMode === mode ? "var(--fg-dim)" : "transparent",
                color: colorMode === mode ? "#0c0c0e" : "var(--fg-muted)",
                border: "1px solid var(--border-light)",
                borderRadius: 4,
                padding: "3px 10px",
                font: "inherit",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {colorMode === "scene" ? (
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--fg-muted)" }}>
            <span style={{ color: "var(--fg-ghost)" }}>granularity</span>
            <input
              type="range"
              min="0.6"
              max="2.4"
              step="0.1"
              value={resInput}
              onChange={(e) => onResolution(+e.target.value)}
              style={{ width: 140, accentColor: "var(--fg-dim)" }}
            />
            <span style={{ color: "var(--fg-ghost)", minWidth: 110 }}>
              {resInput < 0.9 ? "fewer, broader" : resInput > 1.6 ? "many, tighter" : "balanced"}
              {resInput === resolution ? ` · ${scenes.length}` : " · …"}
            </span>
          </label>
        ) : (
          <span style={{ color: "var(--fg-ghost)" }}>colored by primary instrument family</span>
        )}
      </div>

      {/* Legend */}
      {colorMode === "scene" ? (
        <div className="mono" style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 10, color: "var(--fg-muted)", marginBottom: "var(--space-sm)" }}>
          {namedScenes.map((s) => (
            <span
              key={s.id}
              style={{
                cursor: "pointer",
                opacity: commFilter && commFilter !== s.id ? 0.25 : 1,
                transition: "opacity 0.2s",
                display: "flex", alignItems: "center", gap: 4,
              }}
              onClick={() => setCommFilter(commFilter === s.id ? null : s.id)}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, display: "inline-block" }} />
              {s.name} <span style={{ color: "var(--fg-ghost)" }}>· {s.size}</span>
            </span>
          ))}
        </div>
      ) : (
        <div className="mono" style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 10, color: "var(--fg-muted)", marginBottom: "var(--space-sm)" }}>
          {instruments.map((inst) => (
            <span
              key={inst}
              style={{
                cursor: "pointer",
                opacity: instFilter && instFilter !== inst ? 0.2 : 1,
                transition: "opacity 0.2s",
                display: "flex", alignItems: "center", gap: 3,
              }}
              onClick={() => setInstFilter(instFilter === inst ? null : inst)}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: instrumentColor(inst), display: "inline-block" }} />
              {inst}
            </span>
          ))}
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={dims.w}
        height={dims.h}
        style={{ display: "block", width: dims.w, height: dims.h, borderRadius: "var(--radius-md)", background: "#0c0c0e" }}
      />

      {tip && (
        <div className="mono" style={{
          position: "fixed", left: tip.x + 14, top: tip.y - 8,
          background: "var(--surface)", border: "1px solid var(--border-light)",
          borderRadius: 6, padding: "7px 11px", fontSize: 11,
          color: "var(--fg-dim)", whiteSpace: "pre-line", pointerEvents: "none", zIndex: 100,
        }}>
          {tip.text}
        </div>
      )}

      <p className="mono" style={{ textAlign: "center", fontSize: 10, color: "var(--fg-ghost)", marginTop: "var(--space-sm)" }}>
        Scroll to zoom · Hover to explore · Click to view artist · Click legend to isolate a {colorMode === "scene" ? "scene" : "instrument"}
      </p>
    </div>
  );
}
