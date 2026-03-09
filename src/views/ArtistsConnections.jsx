import { useMemo, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useData } from "../App";
import { instrumentFamily, familyColor, slugify } from "../data";
import StatCard from "../components/StatCard";

/**
 * Build a musician-to-musician collaboration graph from album lineups.
 * Two musicians are connected if they appeared on the same album.
 */
function buildCollabGraph(albums) {
  const edges = new Map(); // "a|b" → { count, albums }
  const nodes = new Map(); // name → { albums, instruments }

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
    // Connect every pair on this album
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const key = [names[i], names[j]].sort().join("|");
        if (!edges.has(key)) edges.set(key, { count: 0, albums: [] });
        const e = edges.get(key);
        e.count++;
        e.albums.push(album.title);
        nodes.get(names[i]).collabs.add(names[j]);
        nodes.get(names[j]).collabs.add(names[i]);
      }
    }
  }

  return { nodes, edges };
}

/**
 * BFS shortest path between two musicians.
 */
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

export default function ArtistsConnections() {
  const { albums } = useData();
  const [sourceInput, setSourceInput] = useState("");
  const [targetInput, setTargetInput] = useState("");
  const [source, setSource] = useState(null);
  const [target, setTarget] = useState(null);
  const [path, setPath] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const { nodes, edges, ranked, stats } = useMemo(() => {
    const { nodes, edges } = buildCollabGraph(albums);

    // Track leader vs sideman connections
    const leaderCollabs = new Map(); // name → Set of unique collabs as leader
    const sidemanCollabs = new Map(); // name → Set of unique collabs as sideperson
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

    // Most connected as leader
    const topLeader = [...leaderCollabs.entries()]
      .sort((a, b) => b[1].size - a[1].size)[0];
    // Most connected as sideman
    const topSideman = [...sidemanCollabs.entries()]
      .sort((a, b) => b[1].size - a[1].size)[0];
    // Average degrees of separation (sample a few random pairs)
    const totalConnected = ranked.filter((r) => r.collabs > 0).length;

    const stats = {
      totalConnected,
      mostConnected: ranked[0] ? `${ranked[0].name} (${ranked[0].collabs})` : "",
      topLeader: topLeader ? `${topLeader[0]} (${topLeader[1].size})` : "",
      topSideman: topSideman ? `${topSideman[0]} (${topSideman[1].size})` : "",
    };

    return { nodes, edges, ranked, stats };
  }, [albums]);

  // Autocomplete suggestions
  const allNames = useMemo(() => ranked.map((r) => r.name), [ranked]);

  const suggestions = useCallback(
    (input) => {
      if (!input || input.length < 2) return [];
      const lower = input.toLowerCase();
      return allNames.filter((n) => n.toLowerCase().includes(lower)).slice(0, 8);
    },
    [allNames],
  );

  const doSearch = () => {
    if (!source || !target) return;
    const result = findPath(nodes, source, target);
    if (result) {
      setPath(result);
      setNotFound(false);
    } else {
      setPath(null);
      setNotFound(true);
    }
  };

  // Shared albums between two musicians
  const sharedAlbums = (a, b) => {
    const key = [a, b].sort().join("|");
    const edge = edges.get(key);
    return edge ? edge.albums : [];
  };

  const top50 = ranked.slice(0, 50);

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)" }}>
      <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 4 }}>six degrees of jazz</h1>
      <p
        className="mono"
        style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}
      >
        How many handshakes connect any two jazz musicians?
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
      <div
        style={{
          display: "flex",
          gap: "var(--space-md)",
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: "var(--space-xl)",
        }}
      >
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
          onClick={doSearch}
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
      </div>

      {/* Path result */}
      {path && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-lg)",
            marginBottom: "var(--space-xl)",
          }}
        >
          <div className="mono" style={{ fontSize: 12, color: "var(--fg-ghost)", marginBottom: "var(--space-md)" }}>
            {path.length - 1} degree{path.length - 1 !== 1 ? "s" : ""} of separation
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0 }}>
            {path.map((name, i) => {
              const node = nodes.get(name);
              const inst = node ? [...node.instruments][0] : null;
              const family = instrumentFamily(inst);
              const shared = i < path.length - 1 ? sharedAlbums(name, path[i + 1]) : [];
              return (
                <div key={i} style={{ display: "flex", alignItems: "center" }}>
                  <Link
                    to={`/artist/${slugify(name)}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: "var(--radius-sm)",
                      background: i === 0 || i === path.length - 1 ? "var(--border)" : "transparent",
                      textDecoration: "none",
                      color: "var(--fg)",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: familyColor(family),
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 13, fontWeight: i === 0 || i === path.length - 1 ? 700 : 400 }}>
                      {name}
                    </span>
                  </Link>
                  {i < path.length - 1 && (
                    <span
                      className="mono"
                      title={shared.slice(0, 5).join(", ")}
                      style={{ fontSize: 9, color: "var(--fg-ghost)", padding: "0 4px", cursor: "help" }}
                    >
                      — {shared.length} album{shared.length !== 1 ? "s" : ""} →
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {notFound && (
        <div
          className="mono"
          style={{
            fontSize: 12,
            color: "var(--fg-ghost)",
            marginBottom: "var(--space-xl)",
            padding: "var(--space-md)",
            background: "var(--surface)",
            borderRadius: "var(--radius-sm)",
          }}
        >
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
          <Link
            key={m.name}
            to={`/artist/${slugify(m.name)}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-sm)",
              padding: "8px 12px",
              textDecoration: "none",
              color: "var(--fg)",
              background: i % 2 === 0 ? "var(--surface)" : "transparent",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <span
              className="mono"
              style={{ width: 24, textAlign: "right", fontSize: 10, color: "var(--fg-ghost)", flexShrink: 0 }}
            >
              {i + 1}
            </span>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: familyColor(m.family),
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{m.name}</span>
            <span className="mono" style={{ fontSize: 10, color: "var(--fg-ghost)" }}>
              {m.collabs} connections
            </span>
            <span className="mono" style={{ fontSize: 10, color: "var(--fg-ghost)", width: 60, textAlign: "right" }}>
              {m.albums} albums
            </span>
          </Link>
        ))}
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
          width: "100%",
          padding: "6px 10px",
          fontSize: 12,
          background: "var(--surface)",
          color: "var(--fg)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          outline: "none",
        }}
      />
      {open && matches.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            marginTop: 2,
            zIndex: 50,
            maxHeight: 200,
            overflow: "auto",
          }}
        >
          {matches.map((name, i) => (
            <div
              key={name}
              onMouseDown={() => onSelect(name)}
              className="mono"
              style={{
                padding: "5px 10px",
                fontSize: 11,
                cursor: "pointer",
                background: i === highlighted ? "var(--border)" : "transparent",
                color: "var(--fg-dim)",
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
