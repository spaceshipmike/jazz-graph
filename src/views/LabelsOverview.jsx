import { useMemo } from "react";
import { useData } from "../App";
import { LABELS } from "../data";
import HorizontalBars from "../components/HorizontalBars";

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
      .slice(0, 24)
      .map(([label, count]) => ({
        label,
        value: count,
        color: LABELS[label] || "#888",
      }));
  }, [albums]);

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>Labels</h1>
      <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}>
        {albums.length} albums across {new Set(albums.map((a) => a.label || "Unknown")).size} labels
      </p>
      <HorizontalBars data={data} maxBars={24} />
    </div>
  );
}
