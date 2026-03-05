import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useData } from "../App";

export default function Color() {
  const { albums } = useData();

  const sorted = useMemo(() => {
    const withColor = albums.filter((a) => a.coverPath && a.palette && a.palette.length > 0);

    function metrics(album) {
      const p = album.palette;
      const avgL = p.reduce((s, c) => s + c.l * c.pct, 0) / 100;
      const avgS = p.reduce((s, c) => s + c.s * c.pct, 0) / 100;
      const maxSat = Math.max(...p.map(c => c.s));

      // Representative color: area-weighted, with saturation bonus for large clusters
      let best = p[0], bestScore = -1;
      for (const c of p) {
        const areaWeight = c.pct * 2;
        const satBonus = c.pct >= 15 ? c.s : c.s * 0.3;
        const lightPenalty = c.l < 10 ? 50 : c.l > 90 ? 50 : 0;
        const score = areaWeight + satBonus - lightPenalty;
        if (score > bestScore) { bestScore = score; best = c; }
      }

      // Accent color for monochrome covers
      let accent = null, accScore = -1;
      for (const c of p) {
        if (c.l <= 15 && c.s <= 20) continue;
        if (c.l >= 88) continue;
        const score = c.s * 0.7 + c.pct * 0.3;
        if (score > accScore) { accScore = score; accent = c; }
      }

      // Monochrome detection
      let darkPct = 0, lightPct = 0;
      for (const c of p) {
        if (c.l <= 15 && c.s <= 20) darkPct += c.pct;
        if (c.l >= 95 || (c.l >= 88 && c.s <= 15)) lightPct += c.pct;
      }
      let mono = null;
      if (darkPct >= 45) mono = "black";
      else if (lightPct >= 45) mono = "white";
      else if (darkPct + lightPct >= 75) mono = darkPct >= lightPct ? "black" : "white";
      else if (maxSat <= 10) mono = avgL >= 50 ? "white" : "black";

      // Tier: 0=black, 1=dark, 2=mid, 3=light, 4=white
      let tier;
      if (mono === "black") tier = 0;
      else if (mono === "white") tier = 4;
      else if (best.l < 25) tier = 1;
      else if (best.l > 75) tier = 3;
      else tier = 2;

      return { avgL, avgS, rep: best, accent, tier };
    }

    withColor.sort((a, b) => {
      const ma = metrics(a), mb = metrics(b);
      if (ma.tier !== mb.tier) return ma.tier - mb.tier;

      // Black/white tiers: sort by accent hue, then lightness
      if (ma.tier === 0 || ma.tier === 4) {
        const hA = ma.accent ? ma.accent.h : -1;
        const hB = mb.accent ? mb.accent.h : -1;
        if (hA !== hB) return hA - hB;
        return ma.avgL - mb.avgL;
      }

      // Color tiers (1, 2, 3): hue first, then lightness
      if (ma.rep.h !== mb.rep.h) return ma.rep.h - mb.rep.h;
      if (ma.rep.l !== mb.rep.l) return ma.rep.l - mb.rep.l;
      return mb.rep.s - ma.rep.s;
    });

    return withColor;
  }, [albums]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
        width: "100%",
        marginTop: "var(--space-lg)",
      }}
    >
      {sorted.map((album) => (
        <Link
          key={album.id}
          to={`/album/${album.id}`}
          style={{ display: "block", aspectRatio: "1", overflow: "hidden" }}
        >
          {album.coverPath ? (
            <img
              src={`/data/${album.coverPath}`}
              alt={album.title}
              loading="lazy"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                transition: "filter 200ms ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.2)")}
              onMouseLeave={(e) => (e.currentTarget.style.filter = "brightness(1)")}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "var(--surface)",
              }}
            />
          )}
        </Link>
      ))}
    </div>
  );
}
