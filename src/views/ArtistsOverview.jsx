import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../App";
import { instrumentFamily, familyColor } from "../data";
import HorizontalBars from "../components/HorizontalBars";

export default function ArtistsOverview() {
  const { albums, index } = useData();
  const navigate = useNavigate();

  const data = useMemo(() => {
    if (!index) return [];
    return index.musicians
      .slice(0, 24)
      .map((m) => ({
        label: m.name,
        value: m.albums.length,
        color: familyColor(instrumentFamily(m.primary)),
        slug: m.slug,
      }));
  }, [index]);

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>Artists</h1>
      <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}>
        {index ? index.musicians.length : 0} musicians across {albums.length} albums
      </p>
      <HorizontalBars
        data={data}
        maxBars={24}
        onBarClick={(d) => navigate(`/artist/${d.slug}`)}
      />
    </div>
  );
}
