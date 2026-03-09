import { useMemo } from "react";
import { useData } from "../App";
import { instrumentFamily, familyColor } from "../data";
import HorizontalBars from "../components/HorizontalBars";

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

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)" }}>
      <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 4 }}>Lead Instruments</h1>
      <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}>
        Which instruments lead jazz albums
      </p>
      <HorizontalBars data={data} />
    </div>
  );
}
