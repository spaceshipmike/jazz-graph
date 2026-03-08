import { useMemo } from "react";
import { useData } from "../App";
import { getAllTitles, extractPlaces } from "../titleAnalysis";
import HorizontalBars from "../components/HorizontalBars";

const REGION_MAP = {
  "New York": "US Northeast",
  "Harlem": "US Northeast",
  "Brooklyn": "US Northeast",
  "Broadway": "US Northeast",
  "52nd Street": "US Northeast",
  "Village": "US Northeast",
  "Boston": "US Northeast",
  "Newport": "US Northeast",
  "Philadelphia": "US Northeast",
  "Montreal": "US Northeast",
  "Chicago": "US Midwest",
  "Detroit": "US Midwest",
  "St. Louis": "US Midwest",
  "Memphis": "US South",
  "New Orleans": "US South",
  "Mississippi": "US South",
  "San Francisco": "US West",
  "Los Angeles": "US West",
  "Paris": "Europe",
  "London": "Europe",
  "Berlin": "Europe",
  "Vienna": "Europe",
  "Stockholm": "Europe",
  "Copenhagen": "Europe",
  "Amsterdam": "Europe",
  "Montreux": "Europe",
  "Spain": "Europe",
  "Tokyo": "Asia",
  "Japan": "Asia",
  "India": "Asia",
  "Havana": "Latin America & Caribbean",
  "Cuba": "Latin America & Caribbean",
  "Brazil": "Latin America & Caribbean",
  "Rio de Janeiro": "Latin America & Caribbean",
  "Caribbean": "Latin America & Caribbean",
  "Latin America": "Latin America & Caribbean",
  "Africa": "Africa & Other",
  "Atlantic": "Africa & Other",
  "Pacific": "Africa & Other",
};

const REGION_COLORS = {
  "US Northeast": "#5b9bd5",
  "US South": "#d4a843",
  "US Midwest": "#6bb5a0",
  "US West": "#e07b54",
  "Europe": "#7c5cbf",
  "Asia": "#c75dab",
  "Latin America & Caribbean": "#45a67d",
  "Africa & Other": "#b0884a",
};

const REGION_ORDER = [
  "US Northeast", "US South", "US Midwest", "US West",
  "Europe", "Asia", "Latin America & Caribbean", "Africa & Other",
];

export default function WordsGeography() {
  const { albums } = useData();

  const { sections, titleCount, placeCount, globalMax } = useMemo(() => {
    const titles = getAllTitles(albums);
    const places = extractPlaces(titles);

    // Group by region
    const regionGroups = new Map();
    for (const place of places) {
      const region = REGION_MAP[place.label] || "Africa & Other";
      if (!regionGroups.has(region)) regionGroups.set(region, []);
      regionGroups.get(region).push(place);
    }

    // Build sections in order
    const secs = [];
    for (const region of REGION_ORDER) {
      const group = regionGroups.get(region);
      if (!group || group.length === 0) continue;
      const sorted = group.sort((a, b) => b.count - a.count);
      secs.push({
        region,
        color: REGION_COLORS[region],
        places: sorted,
        total: sorted.reduce((s, p) => s + p.count, 0),
      });
    }

    const allCounts = secs.flatMap((s) => s.places.map((p) => p.count));
    const globalMax = allCounts.length > 0 ? Math.max(...allCounts) : 1;
    return { sections: secs, titleCount: titles.length, placeCount: places.length, globalMax };
  }, [albums]);

  return (
    <div className="fade-in" style={{ padding: "var(--space-xl)" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>Geography</h1>
      <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)", marginBottom: "var(--space-lg)" }}>
        Place names in {titleCount.toLocaleString()} song and album titles — {placeCount} locations found
      </p>

      {sections.map((section) => (
        <div key={section.region} style={{ marginBottom: "var(--space-lg)" }}>
          <h3
            className="mono"
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: section.color,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 6,
            }}
          >
            {section.region} — {section.total} mentions
          </h3>
          <HorizontalBars
            data={section.places.map((p) => ({
              label: p.label,
              value: p.count,
              color: section.color,
            }))}
            maxBars={20}
            globalMax={globalMax}
          />
        </div>
      ))}
    </div>
  );
}
