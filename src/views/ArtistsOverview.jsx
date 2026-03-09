import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../App";
import { instrumentFamily, familyColor } from "../data";
import HorizontalBars from "../components/HorizontalBars";
import StatCard from "../components/StatCard";

function InstrumentBreakdown({ items }) {
  const total = items.reduce((s, i) => s + i.count, 0);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map(({ instrument, count, color }) => (
        <div key={instrument} style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "var(--surface)", borderRadius: "var(--radius-sm)",
          padding: "6px 10px",
        }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "var(--fg-dim)" }}>{instrument}</span>
          <span className="mono" style={{ fontSize: 10, color: "var(--fg-muted)" }}>{count}</span>
          <span className="mono" style={{ fontSize: 9, color: "var(--fg-ghost)" }}>
            {Math.round(count / total * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ArtistsOverview() {
  const { albums, index } = useData();
  const navigate = useNavigate();

  const data = useMemo(() => {
    if (!index) return [];
    return index.musicians
      .slice(0, 100)
      .map((m) => ({
        label: m.name,
        value: m.albums.length,
        color: familyColor(instrumentFamily(m.primary)),
        slug: m.slug,
      }));
  }, [index]);

  const stats = useMemo(() => {
    if (!index || index.musicians.length === 0) return null;
    const top100 = index.musicians.slice(0, 100);
    const top10 = index.musicians.slice(0, 10);

    // Total appearances for top 10 and top 100
    const top10Albums = top10.reduce((s, m) => s + m.albums.length, 0);
    const top100Albums = top100.reduce((s, m) => s + m.albums.length, 0);
    const totalAppearances = index.musicians.reduce((s, m) => s + m.albums.length, 0);

    // Primary instrument breakdown for top 100
    const instCounts = new Map();
    for (const m of top100) {
      const inst = m.primary;
      instCounts.set(inst, (instCounts.get(inst) || 0) + 1);
    }
    const instruments = [...instCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([instrument, count]) => ({
        instrument,
        count,
        color: familyColor(instrumentFamily(instrument)),
      }));

    // Career span for top 100
    const spans = top100.map((m) => {
      const years = m.albums.map((a) => a.year).filter(Boolean);
      if (years.length < 2) return 0;
      return Math.max(...years) - Math.min(...years);
    }).filter((s) => s > 0);
    const avgSpan = spans.length > 0 ? Math.round(spans.reduce((s, v) => s + v, 0) / spans.length) : 0;

    // Most prolific
    const most = top100[0];

    return {
      totalMusicians: index.musicians.length,
      top10Pct: Math.round(top10Albums / totalAppearances * 100),
      top100Pct: Math.round(top100Albums / totalAppearances * 100),
      top10Albums,
      avgSpan,
      mostProlific: most ? `${most.name} (${most.albums.length})` : "",
      instruments,
    };
  }, [index]);

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)" }}>
      <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 4 }}>artists</h1>
      <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}>
        {stats ? stats.totalMusicians : 0} musicians across {albums.length} albums
      </p>

      {stats && (
        <section style={{ marginBottom: "var(--space-2xl)" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 8,
            marginBottom: "var(--space-lg)",
          }}>
            <StatCard label="musicians in the dataset" value={stats.totalMusicians.toLocaleString()} />
            <StatCard
              label="of all credits go to just 10 artists"
              value={`${stats.top10Pct}%`}
            />
            <StatCard
              label="of all credits go to the top 100"
              value={`${stats.top100Pct}%`}
            />
            <StatCard label="average career in the top 100" value={`${stats.avgSpan} years`} />
          </div>

          <h2 style={{ fontSize: 16, fontWeight: 300, marginBottom: 8 }}>primary instruments — top 100</h2>
          <InstrumentBreakdown items={stats.instruments} />
        </section>
      )}

      <h2 style={{ fontSize: 16, fontWeight: 300, marginBottom: "var(--space-md)" }}>top 100 by appearances</h2>
      <HorizontalBars
        data={data}
        maxBars={100}
        onBarClick={(d) => navigate(`/artist/${d.slug}`)}
      />
    </div>
  );
}
