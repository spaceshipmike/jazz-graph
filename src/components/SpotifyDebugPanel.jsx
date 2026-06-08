import { useState } from "react";
import { useSpotify } from "../spotify";

function formatExpiry(timestamp) {
  if (!timestamp) return "none";
  const delta = Math.round((timestamp - Date.now()) / 1000);
  return `${delta}s`;
}

export default function SpotifyDebugPanel() {
  const [open, setOpen] = useState(true);
  const {
    authError,
    debug,
    deviceId,
    durationMs,
    footerVisible,
    isConfigured,
    isLoggedIn,
    isPaused,
    isPremium,
    nowPlaying,
    playerReady,
    profile,
    progressMs,
    sdkReady,
  } = useSpotify();

  // Opt-in only: set VITE_SHOW_SPOTIFY_DEBUG=true to surface it (was on for all of dev).
  const enabled = import.meta.env.VITE_SHOW_SPOTIFY_DEBUG === "true";
  if (!enabled) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        bottom: footerVisible ? 152 : 16,
        zIndex: 41,
        width: 320,
        background: "rgba(8, 8, 10, 0.94)",
        border: "1px solid var(--border-light)",
        borderRadius: "var(--radius-md)",
        boxShadow: "0 16px 40px rgba(0, 0, 0, 0.4)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mono"
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 12px",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--fg-muted)",
          borderBottom: open ? "1px solid var(--border)" : "none",
        }}
      >
        Spotify Debug
        <span>{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mono" style={{ padding: 12, fontSize: 10, color: "var(--fg-muted)", display: "grid", gap: 8 }}>
          <DebugRow label="configured" value={String(isConfigured)} />
          <DebugRow label="logged in" value={String(isLoggedIn)} />
          <DebugRow label="premium" value={String(isPremium)} />
          <DebugRow label="sdk ready" value={String(sdkReady)} />
          <DebugRow label="player ready" value={String(playerReady)} />
          <DebugRow label="paused" value={String(isPaused)} />
          <DebugRow label="device" value={deviceId || "none"} />
          <DebugRow label="user" value={profile?.display_name || profile?.id || "none"} />
          <DebugRow label="redirect" value={debug.redirectUri || "none"} />
          <DebugRow label="expiry" value={formatExpiry(debug.tokenExpiry)} />
          <DebugRow label="progress" value={`${Math.round(progressMs / 1000)}s / ${Math.round(durationMs / 1000)}s`} />
          <DebugRow label="track" value={nowPlaying?.title || "none"} />
          <DebugRow label="error" value={authError || "none"} />
        </div>
      )}
    </div>
  );
}

function DebugRow({ label, value }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "84px 1fr", gap: 8, alignItems: "start" }}>
      <span style={{ color: "var(--fg-ghost)", textTransform: "uppercase" }}>{label}</span>
      <span style={{ color: "var(--fg)" }}>{value}</span>
    </div>
  );
}
