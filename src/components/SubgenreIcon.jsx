import { SUBGENRES } from "../subgenres";

const S = 14; // default size

const SHAPES = {
  // Circle family
  "circle-filled": (s) => <circle cx={s/2} cy={s/2} r={s*0.38} fill="currentColor" />,
  "circle-outline": (s) => <circle cx={s/2} cy={s/2} r={s*0.35} fill="none" stroke="currentColor" strokeWidth={1.5} />,
  "circle-half": (s) => (
    <>
      <circle cx={s/2} cy={s/2} r={s*0.35} fill="none" stroke="currentColor" strokeWidth={1.5} />
      <path d={`M${s/2},${s*0.15} A${s*0.35},${s*0.35} 0 0,0 ${s/2},${s*0.85}`} fill="currentColor" />
    </>
  ),
  "circle-dot": (s) => (
    <>
      <circle cx={s/2} cy={s/2} r={s*0.35} fill="none" stroke="currentColor" strokeWidth={1.5} />
      <circle cx={s/2} cy={s/2} r={s*0.12} fill="currentColor" />
    </>
  ),

  // Triangle family
  "triangle-filled": (s) => (
    <polygon points={`${s/2},${s*0.12} ${s*0.88},${s*0.85} ${s*0.12},${s*0.85}`} fill="currentColor" />
  ),
  "triangle-outline": (s) => (
    <polygon points={`${s/2},${s*0.15} ${s*0.85},${s*0.82} ${s*0.15},${s*0.82}`} fill="none" stroke="currentColor" strokeWidth={1.5} />
  ),
  "triangle-inverted": (s) => (
    <polygon points={`${s*0.12},${s*0.15} ${s*0.88},${s*0.15} ${s/2},${s*0.88}`} fill="currentColor" />
  ),

  // Diamond family
  "diamond-filled": (s) => (
    <polygon points={`${s/2},${s*0.1} ${s*0.88},${s/2} ${s/2},${s*0.9} ${s*0.12},${s/2}`} fill="currentColor" />
  ),
  "diamond-outline": (s) => (
    <polygon points={`${s/2},${s*0.14} ${s*0.84},${s/2} ${s/2},${s*0.86} ${s*0.16},${s/2}`} fill="none" stroke="currentColor" strokeWidth={1.5} />
  ),
  "diamond-small": (s) => (
    <polygon points={`${s/2},${s*0.22} ${s*0.76},${s/2} ${s/2},${s*0.78} ${s*0.24},${s/2}`} fill="currentColor" />
  ),

  // Square family
  "square-filled": (s) => (
    <rect x={s*0.18} y={s*0.18} width={s*0.64} height={s*0.64} fill="currentColor" />
  ),
  "square-outline": (s) => (
    <rect x={s*0.2} y={s*0.2} width={s*0.6} height={s*0.6} fill="none" stroke="currentColor" strokeWidth={1.5} />
  ),
  "square-half": (s) => (
    <>
      <rect x={s*0.2} y={s*0.2} width={s*0.6} height={s*0.6} fill="none" stroke="currentColor" strokeWidth={1.5} />
      <rect x={s*0.2} y={s*0.2} width={s*0.3} height={s*0.6} fill="currentColor" />
    </>
  ),

  // Hexagon / other
  "hexagon": (s) => {
    const cx = s/2, cy = s/2, r = s*0.38;
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(" ");
    return <polygon points={pts} fill="none" stroke="currentColor" strokeWidth={1.5} />;
  },
  "star-four": (s) => {
    const cx = s/2, cy = s/2;
    const outer = s * 0.4, inner = s * 0.16;
    const pts = Array.from({ length: 8 }, (_, i) => {
      const a = (Math.PI / 4) * i - Math.PI / 2;
      const r = i % 2 === 0 ? outer : inner;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(" ");
    return <polygon points={pts} fill="currentColor" />;
  },
};

export default function SubgenreIcon({ name, size = S, style = {} }) {
  const info = SUBGENRES[name];
  if (!info) return null;
  const renderer = SHAPES[info.shape];
  if (!renderer) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
      aria-hidden="true"
    >
      {renderer(size)}
    </svg>
  );
}

export function SubgenreBadge({ name, size = 14 }) {
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        color: "var(--fg-dim)",
        padding: "2px 8px 2px 5px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-pill)",
        whiteSpace: "nowrap",
      }}
    >
      <SubgenreIcon name={name} size={size} />
      {name}
    </span>
  );
}
