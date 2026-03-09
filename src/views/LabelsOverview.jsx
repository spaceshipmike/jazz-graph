import { useMemo } from "react";
import { useData } from "../App";
import { LABELS } from "../data";
import HorizontalBars from "../components/HorizontalBars";
import StatCard from "../components/StatCard";

export default function LabelsOverview() {
  const { albums } = useData();

  const data = useMemo(() => {
    const counts = new Map();
    for (const a of albums) {
      const l = a.label || "Unknown";
      counts.set(l, (counts.get(l) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([label, count]) => ({
        label,
        value: count,
        color: LABELS[label] || "#888",
      }));
  }, [albums]);

  const stats = useMemo(() => {
    const counts = new Map();
    const decades = new Map(); // label → Map(decade → count)
    for (const a of albums) {
      const l = a.label || "Unknown";
      counts.set(l, (counts.get(l) || 0) + 1);
      if (a.year) {
        if (!decades.has(l)) decades.set(l, new Map());
        const dec = Math.floor(a.year / 10) * 10;
        const dm = decades.get(l);
        dm.set(dec, (dm.get(dec) || 0) + 1);
      }
    }

    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const totalLabels = sorted.length;
    const total = albums.length;

    // Top 5 share
    const top5Total = sorted.slice(0, 5).reduce((s, [, c]) => s + c, 0);
    const top5Pct = Math.round(top5Total / total * 100);
    const top5Names = sorted.slice(0, 5).map(([l]) => l).join(", ");

    // Single-album labels
    const singleAlbum = sorted.filter(([, c]) => c === 1).length;

    // Peak decade for top label
    const topLabel = sorted[0]?.[0];
    let topLabelPeak = "";
    if (topLabel && decades.has(topLabel)) {
      const dm = decades.get(topLabel);
      const peak = [...dm.entries()].sort((a, b) => b[1] - a[1])[0];
      if (peak) topLabelPeak = `${topLabel} peaked in the ${peak[0]}s`;
    }

    // Most prolific decade overall
    const decadeTotals = new Map();
    for (const a of albums) {
      if (!a.year) continue;
      const dec = Math.floor(a.year / 10) * 10;
      decadeTotals.set(dec, (decadeTotals.get(dec) || 0) + 1);
    }
    const peakDecade = [...decadeTotals.entries()].sort((a, b) => b[1] - a[1])[0];

    // Labels active across most decades
    let mostDecadesLabel = "";
    let mostDecadesCount = 0;
    for (const [label, dm] of decades) {
      if (dm.size > mostDecadesCount) {
        mostDecadesCount = dm.size;
        mostDecadesLabel = label;
      }
    }

    return {
      totalLabels,
      top5Pct,
      top5Names,
      singleAlbum,
      topLabelPeak,
      longestRunning: mostDecadesLabel ? `${mostDecadesLabel} across ${mostDecadesCount} decades` : "",
    };
  }, [albums]);

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)" }}>
      <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 4 }}>labels</h1>
      <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}>
        {albums.length} albums across {stats.totalLabels} labels
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 8,
        marginBottom: "var(--space-2xl)",
      }}>
        <StatCard label="labels in the dataset" value={stats.totalLabels} />
        <StatCard
          label={`of the catalog on just 5 labels`}
          value={`${stats.top5Pct}%`}
          sub={stats.top5Names}
        />
        <StatCard label="labels with only one album" value={stats.singleAlbum} />
        <StatCard label="longest running" value={stats.longestRunning} />
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 300, marginBottom: "var(--space-md)" }}>albums per label</h2>
      <HorizontalBars data={data} maxBars={30} />
    </div>
  );
}
