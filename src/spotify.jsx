import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useToasts } from "./toasts";

const SpotifyContext = createContext(null);

const TOKEN_KEY = "spotify_tokens";
const ALBUM_CACHE_KEY = "spotify_album_cache";
const AUTH_STATE_KEY = "spotify_auth_state";
const AUTH_VERIFIER_KEY = "spotify_auth_verifier";
const RETURN_TO_KEY = "spotify_return_to";
const PLAYER_NAME = "The Jazz Graph";
const DEFAULT_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
];

function getConfig() {
  if (typeof window === "undefined") return { clientId: "", redirectUri: "", scopes: DEFAULT_SCOPES };

  return {
    clientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID || "",
    redirectUri: import.meta.env.VITE_SPOTIFY_REDIRECT_URI || `${window.location.origin}/spotify/callback`,
    scopes: (import.meta.env.VITE_SPOTIFY_SCOPES || DEFAULT_SCOPES.join(" ")).split(/\s+/).filter(Boolean),
  };
}

function readStoredTokens() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readStoredAlbumCache() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ALBUM_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStoredAlbumCache(cache) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ALBUM_CACHE_KEY, JSON.stringify(cache));
}

function writeStoredTokens(tokens) {
  if (typeof window === "undefined") return;
  if (!tokens) {
    window.localStorage.removeItem(TOKEN_KEY);
    return;
  }
  window.localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

function clearAuthSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(AUTH_STATE_KEY);
  window.sessionStorage.removeItem(AUTH_VERIFIER_KEY);
}

function randomString(length = 64) {
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => (byte % 36).toString(36)).join("");
}

async function sha256base64url(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  const base64 = window.btoa(String.fromCharCode(...new Uint8Array(digest)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function spotifyUriToUrl(uri) {
  if (!uri || !uri.startsWith("spotify:")) return null;
  const [, type, id] = uri.split(":");
  if (!type || !id) return null;
  return `https://open.spotify.com/${type}/${id}`;
}

async function loadSdk() {
  if (typeof window === "undefined") throw new Error("Spotify SDK requires a browser");
  if (window.Spotify?.Player) return;

  await new Promise((resolve, reject) => {
    const existing = document.getElementById("spotify-player-sdk");
    if (existing) {
      const prev = window.onSpotifyWebPlaybackSDKReady;
      window.onSpotifyWebPlaybackSDKReady = () => {
        prev?.();
        resolve();
      };
      return;
    }

    const script = document.createElement("script");
    script.id = "spotify-player-sdk";
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Spotify Web Playback SDK"));
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    document.body.appendChild(script);
  });
}

async function exchangeCode({ code, verifier, clientId, redirectUri }) {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error_description || data.error || `Spotify login failed (${res.status})`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
}

async function refreshTokens({ refreshToken, clientId }) {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error_description || data.error || `Spotify refresh failed (${res.status})`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
}

function normalizeTrackTitle(title) {
  return (title || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeAlbumValue(value) {
  return (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildAlbumQueries(album) {
  const title = album.title || "";
  const artist = album.artist || "";
  const normalizedTitle = title
    .replace(/[:,]/g, " ")
    .replace(/\s+-\s+/g, " ")
    .replace(/\b(vol(?:ume)?\.?\s*\d+)\b/gi, (match) => match.replace(/\./g, ""));

  return [
    `album:${title} artist:${artist}`,
    normalizedTitle !== title ? `album:${normalizedTitle} artist:${artist}` : `"${title}" "${artist}"`,
  ].filter(Boolean);
}

function scoreAlbumCandidate(album, candidate) {
  let score = 0;
  const targetTitle = normalizeAlbumValue(album.title);
  const targetArtist = normalizeAlbumValue(album.artist);
  const candidateTitle = normalizeAlbumValue(candidate.name);
  const candidateArtists = (candidate.artists || []).map((artist) => normalizeAlbumValue(artist.name));

  if (candidateTitle === targetTitle) score += 60;
  else if (candidateTitle.includes(targetTitle) || targetTitle.includes(candidateTitle)) score += 36;

  if (candidateArtists.includes(targetArtist)) score += 28;
  else if (candidateArtists.some((artist) => artist.includes(targetArtist) || targetArtist.includes(artist))) score += 16;

  const releaseYear = Number((candidate.release_date || "").slice(0, 4));
  if (album.year && releaseYear) {
    const delta = Math.abs(album.year - releaseYear);
    if (delta === 0) score += 12;
    else if (delta <= 1) score += 8;
    else if (delta <= 3) score += 4;
  }

  if (candidate.album_type === "album" || candidate.album_group === "album") score += 3;
  return score;
}

function chooseAlbumCandidate(album, items) {
  const ranked = items
    .map((candidate) => ({ candidate, score: scoreAlbumCandidate(album, candidate) }))
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0 || ranked[0].score < 45) return null;
  return ranked[0].candidate;
}

function isNearExpiry(tokens) {
  return !tokens?.expiresAt || tokens.expiresAt - Date.now() < 60_000;
}

export function spotifyAlbumUri(album) {
  if (!album) return null;
  return album.spotifyUri || (album.spotifyId ? `spotify:album:${album.spotifyId}` : null);
}

export function spotifyTrackUri(track) {
  if (!track) return null;
  return track.spotifyTrackUri || (track.spotifyTrackId ? `spotify:track:${track.spotifyTrackId}` : null);
}

export function spotifyOpenUrl(uri) {
  return spotifyUriToUrl(uri);
}

export function isAlbumPlayable(album) {
  return !!spotifyAlbumUri(album);
}

export function isTrackPlayable(track) {
  return !!spotifyTrackUri(track);
}

export function SpotifyProvider({ children }) {
  const { showToast } = useToasts();
  const config = useMemo(getConfig, []);
  const [tokens, setTokens] = useState(() => readStoredTokens());
  const [albumCache, setAlbumCache] = useState(() => readStoredAlbumCache());
  const [profile, setProfile] = useState(null);
  const [authError, setAuthError] = useState("");
  const [sdkReady, setSdkReady] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [playerReady, setPlayerReady] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);
  const [playerState, setPlayerState] = useState(null);
  const [nowPlaying, setNowPlaying] = useState(null);
  const [pendingContext, setPendingContext] = useState(null);
  const [busy, setBusy] = useState(false);

  const playerRef = useRef(null);
  const deviceIdRef = useRef("");
  const sdkPromiseRef = useRef(null);
  const refreshPromiseRef = useRef(null);
  const playerReadyPromiseRef = useRef(null);

  const isConfigured = !!config.clientId;
  const isLoggedIn = !!tokens?.accessToken;
  const isPremium = profile?.product === "premium";

  useEffect(() => {
    writeStoredTokens(tokens);
  }, [tokens]);

  useEffect(() => {
    writeStoredAlbumCache(albumCache);
  }, [albumCache]);

  const logout = useCallback(() => {
    clearAuthSession();
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(RETURN_TO_KEY);
    }
    playerRef.current?.disconnect?.();
    playerRef.current = null;
    setTokens(null);
    setProfile(null);
    setAuthError("");
    setPlayerState(null);
    setNowPlaying(null);
    setFooterVisible(false);
    setDeviceId("");
    deviceIdRef.current = "";
    setPlayerReady(false);
    playerReadyPromiseRef.current = null;
  }, []);

  const ensureFreshTokens = useCallback(async () => {
    if (!tokens?.accessToken) throw new Error("Not logged in to Spotify");
    if (!isNearExpiry(tokens)) return tokens;
    if (!tokens.refreshToken) {
      logout();
      throw new Error("Spotify session expired");
    }

    if (!refreshPromiseRef.current) {
      refreshPromiseRef.current = refreshTokens({
        refreshToken: tokens.refreshToken,
        clientId: config.clientId,
      })
        .then((next) => {
          setTokens(next);
          return next;
        })
        .catch((error) => {
          logout();
          throw error;
        })
        .finally(() => {
          refreshPromiseRef.current = null;
        });
    }

    return refreshPromiseRef.current;
  }, [config.clientId, logout, tokens]);

  const spotifyFetch = useCallback(async (path, init = {}) => {
    const fresh = await ensureFreshTokens();
    const headers = new Headers(init.headers || {});
    headers.set("Authorization", `Bearer ${fresh.accessToken}`);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const res = await fetch(`https://api.spotify.com/v1${path}`, {
      ...init,
      headers,
    });

    if (res.status === 204) return null;
    if (res.status === 401 && fresh.refreshToken) {
      const retried = await ensureFreshTokens();
      headers.set("Authorization", `Bearer ${retried.accessToken}`);
      const retry = await fetch(`https://api.spotify.com/v1${path}`, { ...init, headers });
      if (!retry.ok) {
        const text = await retry.text();
        throw new Error(text || `Spotify request failed (${retry.status})`);
      }
      return retry.status === 204 ? null : retry.json();
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Spotify request failed (${res.status})`);
    }
    return res.json();
  }, [ensureFreshTokens]);

  const ensureProfile = useCallback(async () => {
    if (profile) return profile;
    const data = await spotifyFetch("/me");
    setProfile(data);
    return data;
  }, [profile, spotifyFetch]);

  useEffect(() => {
    if (!isLoggedIn) return;

    let cancelled = false;
    ensureFreshTokens()
      .then(() => spotifyFetch("/me"))
      .then((data) => {
        if (!cancelled) {
          setProfile(data);
          setAuthError("");
        }
      })
      .catch((error) => {
        if (!cancelled) setAuthError(error.message);
      });

    return () => {
      cancelled = true;
    };
  }, [ensureFreshTokens, isLoggedIn, spotifyFetch]);

  const ensurePlayer = useCallback(async () => {
    if (!isConfigured) throw new Error("Spotify is not configured");
    if (!isLoggedIn) throw new Error("Spotify login required");
    const resolvedProfile = await ensureProfile();
    if (resolvedProfile?.product !== "premium") {
      throw new Error("Spotify Premium is required for in-browser playback");
    }
    if (playerRef.current && playerReady && deviceIdRef.current) return playerRef.current;

    if (!sdkPromiseRef.current) {
      sdkPromiseRef.current = (async () => {
        await ensureFreshTokens();
        await loadSdk();
        setSdkReady(true);

        if (playerRef.current) return playerRef.current;

        const player = new window.Spotify.Player({
          name: PLAYER_NAME,
          volume: 0.72,
          getOAuthToken: async (callback) => {
            try {
              const fresh = await ensureFreshTokens();
              callback(fresh.accessToken);
            } catch {
              callback("");
            }
          },
        });

        playerReadyPromiseRef.current = new Promise((resolve) => {
          player.addListener("ready", ({ device_id: nextDeviceId }) => {
            deviceIdRef.current = nextDeviceId;
            setDeviceId(nextDeviceId);
            setPlayerReady(true);
            resolve(nextDeviceId);
          });
        });

        player.addListener("not_ready", () => {
          deviceIdRef.current = "";
          setPlayerReady(false);
          playerReadyPromiseRef.current = null;
        });
        player.addListener("player_state_changed", (state) => {
          setPlayerState(state);
          if (!state) return;
          const current = state.track_window.current_track;
          setNowPlaying({
            title: current?.name || pendingContext?.title || "",
            artist: current?.artists?.map((artist) => artist.name).join(", ") || pendingContext?.artist || "",
            album: current?.album?.name || pendingContext?.album || "",
            image: current?.album?.images?.[0]?.url || pendingContext?.image || "",
            uri: current?.uri || pendingContext?.uri || "",
            durationMs: current?.duration_ms || pendingContext?.durationMs || 0,
          });
        });
        player.addListener("authentication_error", ({ message }) => setAuthError(message));
        player.addListener("account_error", ({ message }) => setAuthError(message));

        await player.connect();
        playerRef.current = player;
        await playerReadyPromiseRef.current;
        return player;
      })().finally(() => {
        sdkPromiseRef.current = null;
      });
    }

    return sdkPromiseRef.current;
  }, [ensureFreshTokens, ensureProfile, isConfigured, isLoggedIn, pendingContext, playerReady]);

  const openSpotify = useCallback((uri) => {
    const url = spotifyUriToUrl(uri);
    if (url && typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, []);

  const getAlbumUri = useCallback((album) => {
    if (!album) return null;
    return spotifyAlbumUri(album) || albumCache[album.id]?.spotifyUri || null;
  }, [albumCache]);

  const searchAlbumOnDemand = useCallback(async (album) => {
    const seen = new Set();
    const combined = [];

    for (const query of buildAlbumQueries(album)) {
      const params = new URLSearchParams({
        q: query,
        type: "album",
        limit: "5",
      });
      const data = await spotifyFetch(`/search?${params.toString()}`);
      for (const item of data.albums?.items || []) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        combined.push(item);
      }
      if (combined.length > 0) break;
    }

    return chooseAlbumCandidate(album, combined);
  }, [spotifyFetch]);

  const resolveAlbum = useCallback(async (album) => {
    const existingUri = getAlbumUri(album);
    if (existingUri) {
      return {
        spotifyId: album.spotifyId || albumCache[album.id]?.spotifyId || "",
        spotifyUri: existingUri,
      };
    }

    const match = await searchAlbumOnDemand(album);
    if (!match) {
      throw new Error("Album not found on Spotify");
    }

    const resolved = {
      spotifyId: match.id,
      spotifyUri: match.uri,
      resolvedAt: Date.now(),
    };

    album.spotifyId = album.spotifyId || match.id;
    album.spotifyUri = match.uri;
    setAlbumCache((current) => ({
      ...current,
      [album.id]: resolved,
    }));

    return resolved;
  }, [albumCache, getAlbumUri, searchAlbumOnDemand]);

  const beginLogin = useCallback(async (returnTo) => {
    if (!isConfigured) {
      setAuthError("Missing VITE_SPOTIFY_CLIENT_ID");
      return;
    }
    const verifier = randomString(96);
    const state = randomString(24);
    const challenge = await sha256base64url(verifier);
    window.sessionStorage.setItem(AUTH_STATE_KEY, state);
    window.sessionStorage.setItem(AUTH_VERIFIER_KEY, verifier);
    window.sessionStorage.setItem(RETURN_TO_KEY, returnTo || window.location.pathname + window.location.search);

    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: "code",
      redirect_uri: config.redirectUri,
      code_challenge_method: "S256",
      code_challenge: challenge,
      state,
      scope: config.scopes.join(" "),
    });

    window.location.assign(`https://accounts.spotify.com/authorize?${params.toString()}`);
  }, [config, isConfigured]);

  const completeLogin = useCallback(async ({ code, state, error }) => {
    if (error) throw new Error(error);
    const expectedState = window.sessionStorage.getItem(AUTH_STATE_KEY);
    const verifier = window.sessionStorage.getItem(AUTH_VERIFIER_KEY);

    if (!code || !state || !expectedState || state !== expectedState || !verifier) {
      throw new Error("Spotify login verification failed");
    }

    const nextTokens = await exchangeCode({
      code,
      verifier,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
    });

    clearAuthSession();
    setTokens(nextTokens);
    setAuthError("");
    return window.sessionStorage.getItem(RETURN_TO_KEY) || "/";
  }, [config.clientId, config.redirectUri]);

  const play = useCallback(async ({ uri, contextUri, positionMs = 0, meta }) => {
    if (!uri && !contextUri) return false;
    if (!isLoggedIn) {
      await beginLogin();
      return false;
    }

    setBusy(true);
    setPendingContext(meta || null);
    setFooterVisible(true);

    try {
      // Must be called directly in the user-triggered flow or Spotify may open externally.
      await playerRef.current?.activateElement?.();
      const player = await ensurePlayer();
      await player.activateElement?.();
      const activeDeviceId = deviceIdRef.current || deviceId;
      if (!activeDeviceId) {
        throw new Error("Spotify player device did not become ready");
      }
      await spotifyFetch("/me/player", {
        method: "PUT",
        body: JSON.stringify({
          device_ids: [activeDeviceId],
          play: false,
        }),
      });
      await spotifyFetch(`/me/player/play?device_id=${encodeURIComponent(activeDeviceId)}`, {
        method: "PUT",
        body: JSON.stringify(
          contextUri
            ? { context_uri: contextUri, position_ms: positionMs }
            : { uris: [uri], position_ms: positionMs }
        ),
      });
      return true;
    } catch (error) {
      setAuthError(error.message);
      if (/Album not found on Spotify/i.test(error.message)) {
        showToast(`"${meta?.album || meta?.title || "This album"}" is not available on Spotify.`, { tone: "neutral" });
        return false;
      }
      if (/rate limited/i.test(error.message) || /temporarily unavailable/i.test(error.message) || /429/.test(error.message)) {
        showToast("Spotify lookup is temporarily unavailable. Try again in a bit.", { tone: "warning" });
        return false;
      }
      if (/Premium/.test(error.message)) {
        showToast("Spotify Premium is required for inline playback.", { tone: "warning" });
      } else if (/device did not become ready/i.test(error.message)) {
        showToast("Spotify player is waking up. Try once more.", { tone: "neutral" });
      } else {
        showToast("Spotify playback could not start for this album.", { tone: "warning" });
      }
      openSpotify(uri || contextUri);
      return false;
    } finally {
      setBusy(false);
    }
  }, [beginLogin, deviceId, ensurePlayer, isLoggedIn, openSpotify, showToast, spotifyFetch]);

  const playAlbum = useCallback((album) => {
    return (async () => {
      try {
        let uri = getAlbumUri(album);
        if (!uri) {
          const resolved = await resolveAlbum(album);
          uri = resolved.spotifyUri;
        }
        if (!uri) {
          showToast(`"${album.title}" is not available on Spotify.`, { tone: "neutral" });
          return false;
        }
        return play({
          contextUri: uri,
          meta: {
            title: album.title,
            artist: album.artist,
            album: album.title,
            image: album.coverPath ? `/data/${album.coverPath}` : "",
            uri,
          },
        });
      } catch (error) {
        setAuthError(error.message);
        if (/not found on spotify/i.test(error.message)) {
          showToast(`"${album.title}" is not available on Spotify.`, { tone: "neutral" });
          return false;
        }
        if (/429|temporarily unavailable|request failed/i.test(error.message)) {
          showToast("Spotify lookup is temporarily unavailable. Try again later.", { tone: "warning" });
          return false;
        }
        showToast(`Could not resolve "${album.title}" on Spotify.`, { tone: "warning" });
        return false;
      }
    })();
  }, [getAlbumUri, play, resolveAlbum, showToast]);

  const playTrack = useCallback((track, album) => {
    const uri = spotifyTrackUri(track);
    if (!uri) return Promise.resolve(false);
    return play({
      uri,
      positionMs: 0,
      meta: {
        title: track.title,
        artist: album?.artist || "",
        album: album?.title || "",
        image: album?.coverPath ? `/data/${album.coverPath}` : "",
        uri,
        durationMs: track.lengthMs || 0,
      },
    });
  }, [play]);

  const pause = useCallback(async () => {
    try {
      await playerRef.current?.pause?.();
    } catch (error) {
      setAuthError(error.message);
    }
  }, []);

  const resume = useCallback(async () => {
    try {
      await playerRef.current?.resume?.();
    } catch (error) {
      setAuthError(error.message);
    }
  }, []);

  const next = useCallback(async () => {
    try {
      await playerRef.current?.nextTrack?.();
    } catch (error) {
      setAuthError(error.message);
    }
  }, []);

  const previous = useCallback(async () => {
    try {
      await playerRef.current?.previousTrack?.();
    } catch (error) {
      setAuthError(error.message);
    }
  }, []);

  const seek = useCallback(async (positionMs) => {
    try {
      await playerRef.current?.seek?.(positionMs);
    } catch (error) {
      setAuthError(error.message);
    }
  }, []);

  const returnTo = typeof window !== "undefined" ? window.sessionStorage.getItem(RETURN_TO_KEY) || "/" : "/";
  const isPaused = playerState?.paused ?? true;
  const progressMs = playerState?.position ?? 0;
  const durationMs = playerState?.duration ?? nowPlaying?.durationMs ?? 0;

  const value = useMemo(() => ({
    authError,
    beginLogin,
    busy,
    completeLogin,
    debug: {
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      scopes: config.scopes,
      tokenExpiry: tokens?.expiresAt || null,
    },
    getAlbumUri,
    deviceId,
    dismissFooter: () => setFooterVisible(false),
    footerVisible,
    isConfigured,
    isLoggedIn,
    isPaused,
    isPremium,
    logout,
    next,
    nowPlaying,
    openSpotify,
    pause,
    playAlbum,
    playTrack,
    playerReady,
    previous,
    profile,
    progressMs,
    resume,
    resolveAlbum,
    returnTo,
    sdkReady,
    seek,
    spotifyAlbumUri,
    spotifyTrackUri,
    durationMs,
  }), [
    authError,
    beginLogin,
    busy,
    completeLogin,
    config.clientId,
    config.redirectUri,
    config.scopes,
    getAlbumUri,
    deviceId,
    footerVisible,
    isConfigured,
    isLoggedIn,
    isPaused,
    isPremium,
    logout,
    next,
    nowPlaying,
    openSpotify,
    pause,
    playAlbum,
    playTrack,
    playerReady,
    previous,
    profile,
    progressMs,
    resolveAlbum,
    resume,
    returnTo,
    sdkReady,
    seek,
    durationMs,
    tokens?.expiresAt,
  ]);

  return <SpotifyContext.Provider value={value}>{children}</SpotifyContext.Provider>;
}

export function useSpotify() {
  return useContext(SpotifyContext);
}

export function matchSpotifyTracks(localTracks = [], spotifyTracks = []) {
  const byNormalized = new Map();
  for (const track of spotifyTracks) {
    const key = normalizeTrackTitle(track.name);
    if (!byNormalized.has(key)) byNormalized.set(key, []);
    byNormalized.get(key).push(track);
  }

  return localTracks.map((track) => {
    const key = normalizeTrackTitle(track.title);
    const candidates = byNormalized.get(key) || [];
    const match = candidates.shift();
    if (!match) return track;
    return {
      ...track,
      spotifyTrackId: match.id,
      spotifyTrackUri: match.uri,
    };
  });
}
