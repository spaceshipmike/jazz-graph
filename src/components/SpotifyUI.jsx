import { useLocation } from "react-router-dom";
import { useSpotify, isTrackPlayable } from "../spotify";

function formatMs(ms) {
  if (!ms) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function SpotifyAuthControl() {
  const location = useLocation();
  const { beginLogin, isConfigured, isLoggedIn, logout, profile } = useSpotify();

  if (!isConfigured) return null;

  if (!isLoggedIn) {
    return (
      <button
        type="button"
        onClick={() => beginLogin(location.pathname + location.search)}
        className="mono spotify-auth-button"
      >
        Spotify Login
      </button>
    );
  }

  return (
    <div className="mono spotify-auth-pill">
      <span style={{ color: "var(--fg-muted)" }}>
        {profile?.display_name || "Spotify"}
      </span>
      <button type="button" onClick={logout} className="mono spotify-auth-logout">
        Logout
      </button>
    </div>
  );
}

export function PlayableAlbumArt({
  album,
  children,
  className = "",
  style,
  overlayLabel,
  onNavigate,
  showOverlay = true,
}) {
  const { isLoggedIn, playAlbum } = useSpotify();
  const playable = isLoggedIn;

  if (!playable) return children;

  return (
    <button
      type="button"
      className={`playable-album-art ${className}`.trim()}
      style={style}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        playAlbum(album);
      }}
      onDoubleClick={(event) => {
        if (!onNavigate) return;
        event.preventDefault();
        event.stopPropagation();
        onNavigate();
      }}
      aria-label={overlayLabel || `Play ${album.title} by ${album.artist}`}
    >
      {children}
      {showOverlay && (
        <span className="playable-overlay" aria-hidden="true">
          <span className="playable-glyph">▶</span>
        </span>
      )}
    </button>
  );
}

export function PlayableTrackTitle({
  album,
  track,
  children,
  style,
  className = "",
}) {
  const { isLoggedIn, playTrack } = useSpotify();
  const playable = isLoggedIn && isTrackPlayable(track);

  if (!playable) {
    return <span className={className} style={style}>{children}</span>;
  }

  return (
    <button
      type="button"
      className={`playable-track-title ${className}`.trim()}
      style={style}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        playTrack(track, album);
      }}
      aria-label={`Play ${track.title}`}
    >
      <span>{children}</span>
      <span className="playable-inline-glyph" aria-hidden="true">▶</span>
    </button>
  );
}

export function NowPlayingFooter() {
  const {
    dismissFooter,
    durationMs,
    footerVisible,
    isPaused,
    next,
    nowPlaying,
    openSpotify,
    pause,
    previous,
    progressMs,
    resume,
    seek,
  } = useSpotify();

  if (!footerVisible || !nowPlaying) return null;

  const progress = durationMs > 0 ? Math.min(100, (progressMs / durationMs) * 100) : 0;
  return (
    <div className="now-playing-footer">
      <div className="now-playing-main">
        <div className="now-playing-media">
          <div className="now-playing-cover">
            {nowPlaying.image ? <img src={nowPlaying.image} alt="" /> : null}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 9, color: "var(--fg-ghost)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Now Playing
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {nowPlaying.title || nowPlaying.album}
            </div>
            <div className="mono" style={{ fontSize: 10, color: "var(--fg-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {[nowPlaying.artist, nowPlaying.album].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>

        <div className="now-playing-controls">
          <button type="button" className="now-playing-button" onClick={previous} aria-label="Previous track">
            ↺
          </button>
          <button
            type="button"
            className="now-playing-button now-playing-button-primary"
            onClick={isPaused ? resume : pause}
            aria-label={isPaused ? "Resume playback" : "Pause playback"}
          >
            {isPaused ? "▶" : "❚❚"}
          </button>
          <button type="button" className="now-playing-button" onClick={next} aria-label="Next track">
            ↻
          </button>
        </div>

        <div className="now-playing-actions">
          <button
            type="button"
            className="mono now-playing-link"
            onClick={() => openSpotify(nowPlaying.uri)}
          >
            Open in Spotify
          </button>
          <button type="button" className="mono now-playing-dismiss" onClick={dismissFooter}>
            Close
          </button>
        </div>
      </div>

      <div className="now-playing-progress">
        <span className="mono">{formatMs(progressMs)}</span>
        <input
          type="range"
          min="0"
          max={durationMs || 1}
          value={Math.min(progressMs, durationMs || 1)}
          onChange={(event) => seek(Number(event.target.value))}
          aria-label="Seek playback"
        />
        <span className="mono">{formatMs(durationMs)}</span>
      </div>
      <div className="now-playing-progress-bar" style={{ transform: `scaleX(${progress / 100 || 0})` }} />
    </div>
  );
}
