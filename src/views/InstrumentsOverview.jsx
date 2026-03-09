import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useData } from "../App";
import { instrumentFamily, familyColor } from "../data";
import HorizontalBars from "../components/HorizontalBars";

const RARE_THRESHOLD = 5;

export default function InstrumentsOverview() {
  const { albums } = useData();

  const data = useMemo(() => {
    const counts = new Map();
    for (const a of albums) {
      for (const m of a.lineup) {
        if (m.lead && m.instrument !== "unknown" && m.instrument !== "leader") {
          counts.set(m.instrument, (counts.get(m.instrument) || 0) + 1);
        }
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([inst, count]) => ({
        label: inst,
        value: count,
        color: familyColor(instrumentFamily(inst)),
      }));
  }, [albums]);

  // Rare instruments: count ALL appearances (not just lead), find albums
  const rareInstruments = useMemo(() => {
    const instMap = new Map(); // instrument → { count, albums[] }
    for (const a of albums) {
      for (const m of a.lineup) {
        if (m.instrument === "unknown" || m.instrument === "leader" || m.instrument.includes("vocals")) continue;
        if (!instMap.has(m.instrument)) {
          instMap.set(m.instrument, { count: 0, albums: [] });
        }
        const entry = instMap.get(m.instrument);
        entry.count++;
        if (!entry.albums.find((x) => x.id === a.id)) {
          entry.albums.push(a);
        }
      }
    }
    return [...instMap.entries()]
      .filter(([, v]) => v.count < RARE_THRESHOLD)
      .sort((a, b) => a[1].count - b[1].count)
      .map(([inst, v]) => ({
        instrument: inst,
        count: v.count,
        family: instrumentFamily(inst),
        color: familyColor(instrumentFamily(inst)),
        albums: v.albums,
      }));
  }, [albums]);

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)" }}>
      <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 4 }}>Lead Instruments</h1>
      <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}>
        Which instruments lead jazz albums
      </p>
      <HorizontalBars data={data} />

      {rareInstruments.length > 0 && (
        <section style={{ marginTop: "var(--space-2xl)" }}>
          <h2 style={{ fontSize: 20, fontWeight: 300, marginBottom: 4 }}>Rare Instruments</h2>
          <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}>
            {rareInstruments.length} instruments appearing fewer than {RARE_THRESHOLD} times — the long tail of jazz
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 6 }}>
            {rareInstruments.map(({ instrument, count, color, albums: instAlbums }) => (
              <div
                key={instrument}
                style={{
                  padding: "10px 12px",
                  background: "var(--surface)",
                  borderRadius: "var(--radius-sm)",
                  borderLeft: `3px solid ${color}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: "var(--fg)" }}>{instrument}</span>
                  <span className="mono" style={{ fontSize: 9, color: "var(--fg-muted)" }}>
                    {count}×
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {instAlbums.map((a) => (
                    <Link
                      key={a.id}
                      to={`/album/${a.id}`}
                      title={`${a.title} — ${a.artist} (${a.year || "?"})`}
                      style={{ textDecoration: "none" }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 3, overflow: "hidden", background: "var(--bg)" }}>
                        {a.coverPath ? (
                          <img
                            src={`/data/${a.coverPath}`}
                            alt={a.title}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            loading="lazy"
                          />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span className="mono" style={{ fontSize: 7, color: "var(--fg-ghost)" }}>?</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
