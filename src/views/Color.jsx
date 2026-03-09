import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useData } from "../App";

export default function Color() {
  const { albums } = useData();

  const sorted = useMemo(() => {
    const withColor = albums.filter((a) => a.coverPath && a.vibrant);

    // CIELAB chroma: distance from neutral axis — low = achromatic
    function labChroma(c) {
      if (c.lab) return Math.sqrt(c.lab.a * c.lab.a + c.lab.b * c.lab.b);
      return c.s;
    }

    // Percentage of palette that is near-neutral, optionally filtered by lightness
    function neutralPct(p, minL = -Infinity, maxL = Infinity) {
      return p.filter(c => {
        if (labChroma(c) >= 15) return false;
        const l = c.lab ? c.lab.L : c.l;
        return l > minL && l < maxL;
      }).reduce((s, c) => s + c.pct, 0);
    }

    // Precompute sort keys for each album in a single pass
    const keys = new Map();
    for (const album of withColor) {
      const p = album.palette;

      // Palette metrics (single pass where possible)
      let avgL = 50, wChroma = 0;
      if (p && p.length > 0) {
        const useLab = p[0] && p[0].lab;
        avgL = p.reduce((s, c) => s + (useLab ? c.lab.L : c.l) * c.pct, 0) / 100;
        wChroma = p.reduce((s, c) => s + labChroma(c) * c.pct, 0) / 100;
      }

      const darkNPct = p ? neutralPct(p, -Infinity, 30) : 0;
      const lightNPct = p ? neutralPct(p, 60, Infinity) : 0;
      const totalNeutral = p ? neutralPct(p) : 0;

      // Monochrome detection
      let mono = false;
      let chromaticPct = 0;
      if (p) {
        const maxChroma = Math.max(...p.map(labChroma));
        chromaticPct = p.filter(c => labChroma(c) >= 15).reduce((s, c) => s + c.pct, 0);
        if (maxChroma <= 12 || wChroma <= 10) mono = true;
        else if (chromaticPct < 20) mono = true; // too little color to be "chromatic"
        else if (Math.max(...p.map(c => c.s)) <= 10) mono = true;
        else {
          let dkPct = 0, ltPct = 0;
          for (const c of p) {
            if (c.l <= 15 && c.s <= 20) dkPct += c.pct;
            if (c.l >= 95 || (c.l >= 88 && c.s <= 15)) ltPct += c.pct;
          }
          if (dkPct >= 45 || ltPct >= 45 || dkPct + ltPct >= 75) mono = true;
        }
      }

      // Tier: 0=black, 1=dark, 2=mid, 3=light, 4=white
      let tier;
      if (avgL < 25) tier = avgL < 15 ? 0 : 1;
      else if (avgL > 85) tier = 4;
      else if (darkNPct >= 70) tier = 1;
      else if (lightNPct >= 70) tier = avgL > 85 ? 4 : 3;
      else if (totalNeutral >= 65 && avgL > 65) tier = 3;
      else if (totalNeutral >= 65 && avgL < 30) tier = 1;
      else if (wChroma < 12 && avgL > 60) tier = 3;
      else if (wChroma < 12 && avgL < 35) tier = 1;
      else if (mono) {
        if (avgL < 30) tier = 0;
        else if (avgL > 70) tier = 4;
        else tier = avgL < 50 ? 1 : 3;
      } else {
        const l = album.vibrant.oklch.l;
        tier = l < 0.3 ? 1 : l > 0.75 ? 3 : 2;
      }

      // Dominant chromatic hue from palette, fallback to vibrant
      // Weight by chroma * coverage so small bright swatches don't dominate
      let hue = album.vibrant.oklch.h || 0;
      if (p) {
        const chromatic = p.filter(c => labChroma(c) >= 15);
        if (chromatic.length > 0) {
          const biggest = chromatic.reduce((a, b) =>
            labChroma(a) * a.pct > labChroma(b) * b.pct ? a : b
          );
          if (biggest.lab) {
            const h = Math.atan2(biggest.lab.b, biggest.lab.a) * (180 / Math.PI);
            hue = h < 0 ? h + 360 : h;
          }
        }
      }

      keys.set(album, { tier, avgL, hue, wChroma, accentHue: album.vibrant.oklch.h || 0 });
    }

    withColor.sort((a, b) => {
      const kA = keys.get(a), kB = keys.get(b);
      if (kA.tier !== kB.tier) return kA.tier - kB.tier;

      // Black tier: sort by lightness (darkest first), then accent hue
      if (kA.tier === 0) {
        if (Math.abs(kA.avgL - kB.avgL) > 3) return kA.avgL - kB.avgL;
        return kA.accentHue - kB.accentHue;
      }

      // Light/white tiers: sort by any remaining chroma (most colorful first), then lightness
      if (kA.tier === 3 || kA.tier === 4) {
        if (Math.abs(kA.wChroma - kB.wChroma) > 2) return kB.wChroma - kA.wChroma;
        if (Math.abs(kA.avgL - kB.avgL) > 3) return kA.avgL - kB.avgL;
        return kA.accentHue - kB.accentHue;
      }

      // Color tiers: coarse hue bin → chroma (saturated first) → fine hue
      const binA = Math.floor(kA.hue / 15), binB = Math.floor(kB.hue / 15);
      if (binA !== binB) return binA - binB;
      if (Math.abs(kA.wChroma - kB.wChroma) > 3) return kB.wChroma - kA.wChroma;
      if (kA.hue !== kB.hue) return kA.hue - kB.hue;
      return a.vibrant.oklch.l - b.vibrant.oklch.l;
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
        </Link>
      ))}
    </div>
  );
}
