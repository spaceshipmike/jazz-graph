import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useData } from "../App";
import { instrumentFamily, familyColor } from "../data";
import HorizontalBars from "../components/HorizontalBars";

const RARE_THRESHOLD = 5;

// Wikipedia links for obscure instruments
const WIKI_LINKS = {
  "surdo": "https://en.wikipedia.org/wiki/Surdo",
  "balafon": "https://en.wikipedia.org/wiki/Balafon",
  "lyricon": "https://en.wikipedia.org/wiki/Lyricon",
  "bodhrán": "https://en.wikipedia.org/wiki/Bodhr%C3%A1n",
  "uilleann pipes": "https://en.wikipedia.org/wiki/Uilleann_pipes",
  "pakhawaj": "https://en.wikipedia.org/wiki/Pakhawaj",
  "cabasa": "https://en.wikipedia.org/wiki/Cabasa",
  "shekere": "https://en.wikipedia.org/wiki/Shekere",
  "basset clarinet": "https://en.wikipedia.org/wiki/Basset_clarinet",
  "caxixi": "https://en.wikipedia.org/wiki/Caxixi",
  "contrabassoon": "https://en.wikipedia.org/wiki/Contrabassoon",
  "koto": "https://en.wikipedia.org/wiki/Koto_(instrument)",
  "gumbri": "https://en.wikipedia.org/wiki/Guembri",
  "daf": "https://en.wikipedia.org/wiki/Daf",
  "celesta": "https://en.wikipedia.org/wiki/Celesta",
  "clavichord": "https://en.wikipedia.org/wiki/Clavichord",
  "ganzá": "https://en.wikipedia.org/wiki/Ganz%C3%A1",
  "berimbau": "https://en.wikipedia.org/wiki/Berimbau",
  "ocarina": "https://en.wikipedia.org/wiki/Ocarina",
  "melodica": "https://en.wikipedia.org/wiki/Melodica",
  "tanpura": "https://en.wikipedia.org/wiki/Tanpura",
  "tambura": "https://en.wikipedia.org/wiki/Tambura",
  "oud": "https://en.wikipedia.org/wiki/Oud",
  "mridangam": "https://en.wikipedia.org/wiki/Mridangam",
  "batá drum": "https://en.wikipedia.org/wiki/Bat%C3%A1_drum",
  "agogô": "https://en.wikipedia.org/wiki/Agog%C3%B4",
  "kora": "https://en.wikipedia.org/wiki/Kora_(instrument)",
  "talking drum": "https://en.wikipedia.org/wiki/Talking_drum",
  "mellophone": "https://en.wikipedia.org/wiki/Mellophone",
  "mbira": "https://en.wikipedia.org/wiki/Mbira",
  "tabla": "https://en.wikipedia.org/wiki/Tabla",
  "vocoder": "https://en.wikipedia.org/wiki/Vocoder",
  "mouth harp": "https://en.wikipedia.org/wiki/Jew%27s_harp",
  "bass recorder": "https://en.wikipedia.org/wiki/Recorder_(musical_instrument)#Bass",
  "tack piano": "https://en.wikipedia.org/wiki/Tack_piano",
};

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
                  {WIKI_LINKS[instrument] ? (
                    <a
                      href={WIKI_LINKS[instrument]}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 13, color: "var(--fg)", textDecoration: "none", borderBottom: "1px dotted var(--fg-ghost)" }}
                    >
                      {instrument}
                    </a>
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--fg)" }}>{instrument}</span>
                  )}
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
