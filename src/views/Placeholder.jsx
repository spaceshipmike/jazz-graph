/**
 * Placeholder panel for sub-views not yet built.
 */
export default function Placeholder({ title, description }) {
  return (
    <div style={{
      padding: "var(--space-xl)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 400,
      gap: 12,
    }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--fg-dim)" }}>{title}</h2>
      <p className="mono" style={{ fontSize: 11, color: "var(--fg-ghost)" }}>{description}</p>
    </div>
  );
}
