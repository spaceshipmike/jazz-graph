#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_FILE = join(ROOT, "data", "albums.json");
const REPORT_FILE = join(ROOT, "data", "spotify-enrichment-report.json");
const PROGRESS_FILE = join(ROOT, "data", ".spotify-enrichment-progress.json");

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET");
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const argList = process.argv.slice(2);
const DRY_RUN = args.has("--dry-run");
const ONLY_MISSING = !args.has("--all");
const RESUME = !args.has("--no-resume");
const CHECKPOINT_EVERY = Number(process.env.SPOTIFY_ENRICH_CHECKPOINT_EVERY || 5);
const LOG_EVERY = Number(process.env.SPOTIFY_ENRICH_LOG_EVERY || 5);
const LIMIT_INDEX = argList.indexOf("--limit");
const LIMIT = LIMIT_INDEX >= 0 ? Number(argList[LIMIT_INDEX + 1]) : null;
const REQUEST_TIMEOUT_MS = Number(process.env.SPOTIFY_ENRICH_TIMEOUT_MS || 15000);
const MAX_RETRY_AFTER_SECONDS = Number(process.env.SPOTIFY_ENRICH_MAX_RETRY_AFTER_SECONDS || 30);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  writeFileSync(file, JSON.stringify(value, null, 2));
}

function normalize(value) {
  return (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\b(remaster(ed)?|mono|stereo|expanded|deluxe|edition|volume|vol)\b/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildQueries(album) {
  const title = album.title || "";
  const artist = album.artist || "";
  const normalizedTitle = title
    .replace(/[:,]/g, " ")
    .replace(/\s+-\s+/g, " ")
    .replace(/\b(vol(?:ume)?\.?\s*\d+)\b/gi, (match) => match.replace(/\./g, ""));
  const primary = `album:${title} artist:${artist}`;
  const fallback = normalizedTitle !== title
    ? `album:${normalizedTitle} artist:${artist}`
    : `"${title}" "${artist}"`;
  return [primary, fallback].filter(Boolean);
}

function scoreAlbumMatch(album, candidate) {
  let score = 0;
  const targetTitle = normalize(album.title);
  const candidateTitle = normalize(candidate.name);
  const targetArtist = normalize(album.artist);
  const candidateArtists = (candidate.artists || []).map((artist) => normalize(artist.name));

  if (candidateTitle === targetTitle) score += 60;
  else if (candidateTitle.includes(targetTitle) || targetTitle.includes(candidateTitle)) score += 38;

  if (candidateArtists.includes(targetArtist)) score += 30;
  else if (candidateArtists.some((artist) => artist.includes(targetArtist) || targetArtist.includes(artist))) score += 18;

  const releaseYear = Number((candidate.release_date || "").slice(0, 4));
  if (album.year && releaseYear) {
    const delta = Math.abs(album.year - releaseYear);
    if (delta === 0) score += 12;
    else if (delta <= 1) score += 8;
    else if (delta <= 3) score += 4;
  }

  const totalTracks = candidate.total_tracks || 0;
  if (album.tracks?.length && totalTracks) {
    const delta = Math.abs(album.tracks.length - totalTracks);
    if (delta === 0) score += 10;
    else if (delta <= 2) score += 5;
  }

  if (candidate.album_group === "album" || candidate.album_type === "album") score += 3;

  return score;
}

function chooseAlbumMatch(album, items) {
  const ranked = items
    .map((candidate) => ({ candidate, score: scoreAlbumMatch(album, candidate) }))
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return null;
  if (ranked[0].score < 45) return null;

  return {
    match: ranked[0].candidate,
    score: ranked[0].score,
    alternatives: ranked.slice(1, 4).map(({ candidate, score }) => ({
      id: candidate.id,
      name: candidate.name,
      artist: candidate.artists?.map((artist) => artist.name).join(", "),
      releaseDate: candidate.release_date,
      score,
    })),
  };
}

async function getAccessToken() {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || `Spotify auth failed (${res.status})`);
  return data.access_token;
}

async function spotifyFetch(token, path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Spotify request timed out after ${REQUEST_TIMEOUT_MS}ms for ${path}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after") || 2);
    if (retryAfter > MAX_RETRY_AFTER_SECONDS) {
      throw new Error(`Spotify rate limited with retry-after ${retryAfter}s for ${path}`);
    }
    console.log(`  rate limited for ${path}, waiting ${retryAfter}s`);
    await sleep(retryAfter * 1000);
    return spotifyFetch(token, path);
  }

  if (!res.ok) throw new Error(`Spotify request failed (${res.status}) for ${path}`);
  return res.json();
}

async function searchAlbum(token, album) {
  const seenIds = new Set();
  const combined = [];

  for (const [attempt, query] of buildQueries(album).entries()) {
    console.log(`  search ${attempt + 1}/${buildQueries(album).length}: ${album.artist} - ${album.title} :: ${query}`);
    const params = new URLSearchParams({
      q: query,
      type: "album",
      limit: "5",
    });
    const data = await spotifyFetch(token, `/search?${params.toString()}`);
    const items = data.albums?.items || [];
    for (const item of items) {
      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);
      combined.push(item);
    }
    if (combined.length > 0) break;
    await sleep(50);
  }

  return chooseAlbumMatch(album, combined);
}

async function getAlbumDetails(token, spotifyId) {
  const album = await spotifyFetch(token, `/albums/${spotifyId}`);
  return {
    spotifyId: album.id,
    spotifyUri: album.uri,
    title: album.name,
    releaseDate: album.release_date,
    totalTracks: album.total_tracks,
  };
}

function buildReportEntry(album, reason, extra = {}) {
  return {
    id: album.id,
    title: album.title,
    artist: album.artist,
    year: album.year || null,
    reason,
    ...extra,
  };
}

async function main() {
  const albums = JSON.parse(readFileSync(DATA_FILE, "utf8"));
  const token = await getAccessToken();
  const progress = RESUME ? readJson(PROGRESS_FILE, { completed: [] }) : { completed: [] };
  const completed = new Set(progress.completed || []);
  const report = {
    updatedAlbums: [],
    unmatchedAlbums: [],
    lowConfidenceMatches: [],
    summary: {},
  };

  const filteredTargets = albums.filter((album) => {
    if (ONLY_MISSING && (album.spotifyUri || album.spotifyId)) return false;
    if (RESUME && completed.has(album.id)) return false;
    return true;
  });
  const targets = LIMIT && Number.isFinite(LIMIT) && LIMIT > 0 ? filteredTargets.slice(0, LIMIT) : filteredTargets;

  console.log(`Spotify enrichment targets: ${targets.length}`);
  console.log(`Mode: ${DRY_RUN ? "dry-run" : "write"}${ONLY_MISSING ? " missing-only" : " full-scan"}${RESUME ? " resume" : ""}${LIMIT ? ` limit=${LIMIT}` : ""}`);

  let matchedAlbums = 0;
  let processed = 0;

  function checkpoint(force = false) {
    if (DRY_RUN) return;
    if (!force && processed > 0 && processed % CHECKPOINT_EVERY !== 0) return;
    writeJson(DATA_FILE, albums);
    writeJson(PROGRESS_FILE, { completed: [...completed] });
    writeJson(REPORT_FILE, report);
  }

  for (let index = 0; index < targets.length; index++) {
    const album = targets[index];
    let spotifyId = album.spotifyId;
    let searchMeta = null;

    try {
      console.log(`album ${index + 1}/${targets.length}: ${album.artist} - ${album.title}`);
      if (!spotifyId) {
        searchMeta = await searchAlbum(token, album);
        if (!searchMeta?.match) {
          report.unmatchedAlbums.push(buildReportEntry(album, "no-spotify-match"));
          completed.add(album.id);
          processed++;
          checkpoint();
          if (processed % LOG_EVERY === 0 || index === targets.length - 1) {
            console.log(`[${index + 1}/${targets.length}] matched albums=${matchedAlbums} unmatched=${report.unmatchedAlbums.length}`);
          }
          continue;
        }

        if (searchMeta.score < 65) {
          report.lowConfidenceMatches.push(buildReportEntry(album, "low-confidence-album-match", {
            score: searchMeta.score,
            chosen: {
              id: searchMeta.match.id,
              name: searchMeta.match.name,
              artist: searchMeta.match.artists?.map((artist) => artist.name).join(", "),
              releaseDate: searchMeta.match.release_date,
            },
            alternatives: searchMeta.alternatives,
          }));
        }

        spotifyId = searchMeta.match.id;
        if (!DRY_RUN) {
          album.spotifyId = searchMeta.match.id;
          album.spotifyUri = searchMeta.match.uri;
        }
        matchedAlbums++;
      }

      const spotifyAlbum = await getAlbumDetails(token, spotifyId);
      if (!DRY_RUN) {
        album.spotifyUri = spotifyAlbum.spotifyUri;
      }

      report.updatedAlbums.push({
        id: album.id,
        title: album.title,
        artist: album.artist,
        spotifyId,
        spotifyUri: spotifyAlbum.spotifyUri,
        score: searchMeta?.score ?? null,
      });

      completed.add(album.id);
      processed++;
      checkpoint();

      if (processed % LOG_EVERY === 0 || index === targets.length - 1) {
        console.log(`[${index + 1}/${targets.length}] matched albums=${matchedAlbums} unmatched=${report.unmatchedAlbums.length}`);
      }

      await sleep(120);
    } catch (error) {
      report.unmatchedAlbums.push(buildReportEntry(album, "request-failed", { error: error.message }));
      completed.add(album.id);
      processed++;
      checkpoint();
      if (processed % LOG_EVERY === 0 || index === targets.length - 1) {
        console.log(`[${index + 1}/${targets.length}] matched albums=${matchedAlbums} unmatched=${report.unmatchedAlbums.length}`);
      }
      await sleep(250);
    }
  }

  report.summary = {
    scanned: targets.length,
    matchedAlbums,
    unmatchedAlbums: report.unmatchedAlbums.length,
    lowConfidenceMatches: report.lowConfidenceMatches.length,
  };

  if (!DRY_RUN) {
    checkpoint(true);
  }

  writeJson(REPORT_FILE, report);

  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Report written to ${REPORT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
