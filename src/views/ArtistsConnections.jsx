import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useData } from "../App";
import { instrumentFamily, familyColor, slugify } from "../data";
import StatCard from "../components/StatCard";

/**
 * Build a musician-to-musician collaboration graph from album lineups.
 * Two musicians are connected if they appeared on the same album. Edges carry
 * the actual albums that link the pair so the path can show cover art.
 */
function buildCollabGraph(albums) {
  const edges = new Map(); // "a|b" → { count, albums: [{ id, title, year, coverPath }] }
  const nodes = new Map(); // name → { instruments, albumCount, collabs }

  for (const album of albums) {
    const names = album.lineup.map((m) => m.name);
    for (const m of album.lineup) {
      if (!nodes.has(m.name)) {
        nodes.set(m.name, { instruments: new Set(), albumCount: 0, collabs: new Set() });
      }
      const n = nodes.get(m.name);
      n.instruments.add(m.instrument);
      n.albumCount++;
    }
    const ref = { id: album.id, title: album.title, year: album.year, coverPath: album.coverPath };
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const key = [names[i], names[j]].sort().join("|");
        if (!edges.has(key)) edges.set(key, { count: 0, albums: [] });
        const e = edges.get(key);
        e.count++;
        e.albums.push(ref);
        nodes.get(names[i]).collabs.add(names[j]);
        nodes.get(names[j]).collabs.add(names[i]);
      }
    }
  }

  return { nodes, edges };
}

/** BFS shortest path between two musicians. */
function findPath(nodes, source, target) {
  if (source === target) return [source];
  const visited = new Set([source]);
  const queue = [[source]];
  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];
    const node = nodes.get(current);
    if (!node) continue;
    for (const neighbor of node.collabs) {
      if (visited.has(neighbor)) continue;
      const newPath = [...path, neighbor];
      if (neighbor === target) return newPath;
      visited.add(neighbor);
      queue.push(newPath);
    }
  }
  return null;
}

function initials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function ArtistsConnections() {
  const { albums, artistPhotos } = useData();
  const navigate = useNavigate();
  const [sourceInput, setSourceInput] = useState("");
  const [targetInput, setTargetInput] = useState("");
  const [source, setSource] = useState(null);
  const [target, setTarget] = useState(null);
  const [path, setPath] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const didAutoRun = useRef(false);

  const { nodes, edges, ranked, stats } = useMemo(() => {
    const { nodes, edges } = buildCollabGraph(albums);

    const leaderCollabs = new Map();
    const sidemanCollabs = new Map();
    for (const album of albums) {
      const names = album.lineup.map((m) => m.name);
      for (const m of album.lineup) {
        for (const other of names) {
          if (other === m.name) continue;
          if (m.lead) {
            if (!leaderCollabs.has(m.name)) leaderCollabs.set(m.name, new Set());
            leaderCollabs.get(m.name).add(other);
          } else {
            if (!sidemanCollabs.has(m.name)) sidemanCollabs.set(m.name, new Set());
            sidemanCollabs.get(m.name).add(other);
          }
        }
      }
    }

    const ranked = [...nodes.entries()]
      .map(([name, data]) => ({
        name,
        collabs: data.collabs.size,
        albums: data.albumCount,
        instrument: [...data.instruments][0],
        family: instrumentFamily([...data.instruments][0]),
      }))
      .sort((a, b) => b.collabs - a.collabs);

    const topLeader = [...leaderCollabs.entries()].sort((a, b) => b[1].size - a[1].size)[0];
    const topSideman = [...sidemanCollabs.entries()].sort((a, b) => b[1].size - a[1].size)[0];
    const totalConnected = ranked.filter((r) => r.collabs > 0).length;

    const stats = {
      totalConnected,
      mostConnected: ranked[0] ? `${ranked[0].name} (${ranked[0].collabs})` : "",
      topLeader: topLeader ? `${topLeader[0]} (${topLeader[1].size})` : "",
      topSideman: topSideman ? `${topSideman[0]} (${topSideman[1].size})` : "",
    };

    return { nodes, edges, ranked, stats };
  }, [albums]);

  const allNames = useMemo(() => ranked.map((r) => r.name), [ranked]);

  const suggestions = useCallback(
    (input) => {
      if (!input || input.length < 2) return [];
      const lower = input.toLowerCase();
      return allNames.filter((n) => n.toLowerCase().includes(lower)).slice(0, 8);
    },
    [allNames],
  );

  const runPath = useCallback(
    (a, b) => {
      setSource(a);
      setTarget(b);
      setSourceInput(a);
      setTargetInput(b);
      const result = findPath(nodes, a, b);
      if (result) {
        setPath(result);
        setNotFound(false);
      } else {
        setPath(null);
        setNotFound(true);
      }
    },
    [nodes],
  );

  // Pick a hub + a peripheral musician — reliably yields an interesting
  // (3–6 hop) journey, so the connecting covers actually have a story to tell.
  const surprise = useCallback(() => {
    const hubs = ranked.slice(0, 60).map((r) => r.name);
    const everyone = ranked.filter((r) => r.collabs > 0).map((r) => r.name);
    if (hubs.length < 1 || everyone.length < 2) return;
    let best = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      const a = hubs[Math.floor(Math.random() * hubs.length)];
      const b = everyone[Math.floor(Math.random() * everyone.length)];
      if (a === b) continue;
      const p = findPath(nodes, a, b);
      if (!p) continue;
      const hops = p.length - 1;
      if (hops < 2) continue; // never show direct (1-degree) connections
      if (hops >= 3 && hops <= 6) { runPath(a, b); return; }
      if (!best || (p.length > best.length && hops <= 7)) best = p;
    }
    if (best) runPath(best[0], best[best.length - 1]);
  }, [ranked, nodes, runPath]);

  // Auto-run a surprise pair on first load so the page greets you in motion.
  useEffect(() => {
    if (didAutoRun.current || !ranked.length) return;
    didAutoRun.current = true;
    surprise();
  }, [ranked, surprise]);

  const sharedAlbums = (a, b) => {
    const key = [a, b].sort().join("|");
    const edge = edges.get(key);
    if (!edge) return [];
    return [...edge.albums].sort((x, y) => (x.year || 0) - (y.year || 0));
  };

  const top50 = ranked.slice(0, 50);
  const degrees = path ? path.length - 1 : 0;

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)" }}>
      <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 4 }}>six degrees of jazz</h1>
      <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}>
        How many degrees of separation connect any two jazz musicians?
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 8,
        marginBottom: "var(--space-xl)",
      }}>
        <StatCard label="musicians connected by collaboration" value={stats.totalConnected.toLocaleString()} />
        <StatCard label="most connected overall" value={stats.mostConnected} />
        <StatCard label="most connected as a bandleader" value={stats.topLeader} />
        <StatCard label="most connected as a sideman" value={stats.topSideman} />
      </div>

      {/* Path finder */}
      <div style={{ display: "flex", gap: "var(--space-md)", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "var(--space-lg)" }}>
        <NameInput
          value={sourceInput}
          onChange={setSourceInput}
          onSelect={(name) => { setSource(name); setSourceInput(name); }}
          suggestions={suggestions}
          placeholder="From musician..."
        />
        <span className="mono" style={{ color: "var(--fg-ghost)", fontSize: 18, paddingTop: 6 }}>→</span>
        <NameInput
          value={targetInput}
          onChange={setTargetInput}
          onSelect={(name) => { setTarget(name); setTargetInput(name); }}
          suggestions={suggestions}
          placeholder="To musician..."
        />
        <button
          onClick={() => source && target && runPath(source, target)}
          disabled={!source || !target}
          className="mono"
          style={{
            background: source && target ? "var(--fg)" : "var(--surface)",
            color: source && target ? "var(--bg)" : "var(--fg-ghost)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "6px 16px",
            fontSize: 12,
            cursor: source && target ? "pointer" : "default",
          }}
        >
          Find path
        </button>
        <button
          onClick={surprise}
          className="mono"
          style={{
            background: "transparent",
            color: "var(--fg-muted)",
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius-sm)",
            padding: "6px 16px",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          ✦ Surprise me
        </button>
      </div>

      {/* Animated journey */}
      {path && (
        <PathJourney
          key={path.join(">")}
          path={path}
          nodes={nodes}
          degrees={degrees}
          sharedAlbums={sharedAlbums}
          artistPhotos={artistPhotos}
          navigate={navigate}
        />
      )}

      {notFound && (
        <div className="mono" style={{
          fontSize: 12, color: "var(--fg-ghost)", marginBottom: "var(--space-xl)",
          padding: "var(--space-md)", background: "var(--surface)", borderRadius: "var(--radius-sm)",
        }}>
          No connection found between {source} and {target}
        </div>
      )}

      {/* Most connected leaderboard */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Most Connected</h2>
      <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-md)" }}>
        Musicians with the most unique collaborators in the collection
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 1 }}>
        {top50.map((m, i) => (
          <button
            key={m.name}
            onClick={() => runPath(top50[0].name === m.name ? top50[1].name : top50[0].name, m.name)}
            title={`Trace a path to ${m.name}`}
            style={{
              display: "flex", alignItems: "center", gap: "var(--space-sm)",
              padding: "8px 12px", textAlign: "left", width: "100%",
              border: "none", color: "var(--fg)", cursor: "pointer",
              background: i % 2 === 0 ? "var(--surface)" : "transparent",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <span className="mono" style={{ width: 24, textAlign: "right", fontSize: 10, color: "var(--fg-ghost)", flexShrink: 0 }}>
              {i + 1}
            </span>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: familyColor(m.family), flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{m.name}</span>
            <span className="mono" style={{ fontSize: 10, color: "var(--fg-ghost)" }}>{m.collabs} connections</span>
            <span className="mono" style={{ fontSize: 10, color: "var(--fg-ghost)", width: 60, textAlign: "right" }}>{m.albums} albums</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** The animated path: artist stations + connecting album covers, traced left→right. */
function PathJourney({ path, nodes, degrees, sharedAlbums, artistPhotos, navigate }) {
  const STEP = 0.18; // seconds between reveals

  const familyOf = (name) => {
    const node = nodes.get(name);
    const inst = node ? [...node.instruments][0] : null;
    return instrumentFamily(inst);
  };

  // Build an interleaved sequence: node, edge, cover, edge, node, ...
  const items = [];
  path.forEach((name, i) => {
    items.push({ kind: "node", name, i });
    if (i < path.length - 1) items.push({ kind: "link", a: name, b: path[i + 1], i });
  });

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)", padding: "var(--space-lg)",
      marginBottom: "var(--space-xl)",
    }}>
      <div style={{ fontSize: 20, fontWeight: 300, marginBottom: 2 }}>
        <strong style={{ fontWeight: 600 }}>{path[0]}</strong>
        {" is "}
        <span style={{ color: "var(--accent, #ffd166)" }}>{degrees} degree{degrees !== 1 ? "s" : ""}</span>
        {" from "}
        <strong style={{ fontWeight: 600 }}>{path[path.length - 1]}</strong>
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}>
        each step is a shared recording session
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 0, rowGap: "var(--space-md)" }}>
        {items.map((item, idx) => {
          const delay = `${idx * STEP}s`;
          if (item.kind === "node") {
            const fam = familyOf(item.name);
            const color = familyColor(fam);
            const photo = artistPhotos[item.name];
            const isEnd = item.i === 0 || item.i === path.length - 1;
            const size = isEnd ? 76 : 60;
            return (
              <div
                key={idx}
                className="journey-item"
                style={{ animationDelay: delay, display: "flex", flexDirection: "column", alignItems: "center", width: 104, flexShrink: 0 }}
              >
                <button
                  onClick={() => navigate(`/artist/${slugify(item.name)}`)}
                  title={item.name}
                  style={{
                    width: size, height: size, borderRadius: "50%", padding: 0, cursor: "pointer",
                    border: `2px solid ${color}`, overflow: "hidden", background: "var(--bg)",
                    boxShadow: isEnd ? `0 0 0 4px ${color}22, 0 0 18px ${color}55` : "none",
                  }}
                >
                  {photo ? (
                    <img src={`/data/${photo}`} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span className="mono" style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: "100%", height: "100%", fontSize: size / 3, color, background: `${color}18`,
                    }}>
                      {initials(item.name)}
                    </span>
                  )}
                </button>
                <span style={{
                  fontSize: 11, fontWeight: isEnd ? 700 : 400, textAlign: "center",
                  marginTop: 6, lineHeight: 1.2, color: "var(--fg)",
                }}>
                  {item.name}
                </span>
              </div>
            );
          }

          // Link: a connecting line + the earliest shared album as a stepping stone.
          const shared = sharedAlbums(item.a, item.b);
          const album = shared[0];
          const extra = shared.length - 1;
          const cA = familyColor(familyOf(item.a));
          const cB = familyColor(familyOf(item.b));
          return (
            <div
              key={idx}
              className="journey-item"
              style={{ animationDelay: delay, display: "flex", flexDirection: "column", alignItems: "center", width: 96, flexShrink: 0, paddingTop: 6 }}
            >
              <div style={{ display: "flex", alignItems: "center", width: "100%", marginBottom: 6 }}>
                <span className="journey-edge" style={{ animationDelay: delay, flex: 1, height: 2, background: `linear-gradient(90deg, ${cA}, var(--border-light))` }} />
                <span style={{ position: "relative" }}>
                  {album && (
                    <button
                      onClick={() => navigate(`/album/${album.id}`)}
                      title={`${album.title}${album.year ? ` (${album.year})` : ""}`}
                      style={{ width: 54, height: 54, padding: 0, borderRadius: 4, overflow: "hidden", border: "1px solid var(--border-light)", cursor: "pointer", background: "var(--bg)", flexShrink: 0, display: "block" }}
                    >
                      {album.coverPath
                        ? <img src={`/data/${album.coverPath}`} alt={album.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <span className="mono" style={{ fontSize: 8, color: "var(--fg-ghost)" }}>♪</span>}
                    </button>
                  )}
                  {extra > 0 && (
                    <span className="mono" style={{
                      position: "absolute", top: -6, right: -6, fontSize: 9, lineHeight: 1,
                      background: "var(--fg)", color: "var(--bg)", borderRadius: 8, padding: "2px 5px",
                    }}>
                      +{extra}
                    </span>
                  )}
                </span>
                <span className="journey-edge" style={{ animationDelay: delay, flex: 1, height: 2, background: `linear-gradient(90deg, var(--border-light), ${cB})` }} />
              </div>
              {album && (
                <span className="mono" style={{ fontSize: 9, color: "var(--fg-ghost)", textAlign: "center", lineHeight: 1.25, maxWidth: 92 }}>
                  {album.title.length > 28 ? album.title.slice(0, 27) + "…" : album.title}
                  {album.year ? ` · ${album.year}` : ""}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Autocomplete input for musician names */
function NameInput({ value, onChange, onSelect, suggestions, placeholder }) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const ref = useRef(null);
  const matches = suggestions(value);

  return (
    <div style={{ position: "relative", width: 240 }} ref={ref}>
      <input
        className="mono"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlighted(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, matches.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
          if (e.key === "Enter" && highlighted >= 0 && matches[highlighted]) {
            onSelect(matches[highlighted]);
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        style={{
          width: "100%", padding: "6px 10px", fontSize: 12,
          background: "var(--surface)", color: "var(--fg)",
          border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", outline: "none",
        }}
      />
      {open && matches.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", marginTop: 2, zIndex: 50, maxHeight: 200, overflow: "auto",
        }}>
          {matches.map((name, i) => (
            <div
              key={name}
              onMouseDown={() => onSelect(name)}
              className="mono"
              style={{
                padding: "5px 10px", fontSize: 11, cursor: "pointer",
                background: i === highlighted ? "var(--border)" : "transparent", color: "var(--fg-dim)",
              }}
            >
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
