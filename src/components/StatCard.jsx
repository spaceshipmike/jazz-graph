export default function StatCard({ label, value, sub }) {
  return (
    <div style={{
      background: "var(--surface)",
      borderRadius: "var(--radius-md)",
      padding: "14px 16px",
      minWidth: 0,
    }}>
      <div style={{ fontSize: 24, fontWeight: 300, fontFamily: "var(--font-display)", color: "var(--fg)" }}>
        {value}
      </div>
      <div className="mono" style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 2 }}>{label}</div>
      {sub && <div className="mono" style={{ fontSize: 9, color: "var(--fg-ghost)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
