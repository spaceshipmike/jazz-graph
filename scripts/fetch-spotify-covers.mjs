#!/usr/bin/env node

/**
 * Fetch higher-quality cover art from Spotify for albums in albums.json.
 * Uses client credentials flow (no user auth needed).
 *
 * Usage:
 *   SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... node scripts/fetch-spotify-covers.mjs
 *   op run --env-file .env -- node scripts/fetch-spotify-covers.mjs
 *
 * Env vars: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_FILE = join(ROOT, "data", "albums.json");
const COVERS_DIR = join(ROOT, "data", "images", "covers");

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Auth ────────────────────────────────────────────────────────────

async function getAccessToken() {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

// ─── Search ──────────────────────────────────────────────────────────

async function searchAlbum(token, title, artist) {
  const query = encodeURIComponent(`album:${title} artist:${artist}`);
  const url = `https://api.spotify.com/v1/search?q=${query}&type=album&limit=5`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("retry-after") || "5", 10);
    console.log(`  Rate limited, waiting ${retryAfter}s...`);
    await sleep(retryAfter * 1000);
    return searchAlbum(token, title, artist);
  }

  if (!res.ok) return null;
  const data = await res.json();
  const albums = data.albums?.items;
  if (!albums || albums.length === 0) return null;

  // Prefer exact title match (case-insensitive)
  const titleLower = title.toLowerCase();
  const match = albums.find((a) => a.name.toLowerCase() === titleLower) || albums[0];

  // Get the largest image (first is usually 640px)
  const image = match.images?.[0];
  if (!image) return null;

  return {
    spotifyId: match.id,
    coverUrl: image.url,
    width: image.width,
  };
}

// ─── Download ────────────────────────────────────────────────────────

async function downloadCover(url, slug) {
  const outPath = join(COVERS_DIR, `${slug}.jpg`);

  const res = await fetch(url);
  if (!res.ok) return false;

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength < 1000) return false;

  writeFileSync(outPath, buf);
  return true;
}

// ─── Main ────────────────────────────────────────────────────────────

const albums = JSON.parse(readFileSync(DATA_FILE, "utf8"));

console.log("═══════════════════════════════════════════════════════════════");
console.log("  Fetching cover art from Spotify");
console.log(`  ${albums.length} albums to process`);
console.log("═══════════════════════════════════════════════════════════════");
console.log();

const token = await getAccessToken();
console.log("✓ Authenticated with Spotify\n");

let upgraded = 0;
let newCovers = 0;
let notFound = 0;
let alreadySpotify = 0;

for (let i = 0; i < albums.length; i++) {
  const album = albums[i];
  const prefix = `[${i + 1}/${albums.length}]`;

  // Skip if already has Spotify ID (already processed)
  if (album.spotifyId) {
    alreadySpotify++;
    continue;
  }

  const result = await searchAlbum(token, album.title, album.artist);

  if (!result) {
    notFound++;
    console.log(`${prefix} · ${album.title} — ${album.artist} (not on Spotify)`);
    await sleep(100);
    continue;
  }

  album.spotifyId = result.spotifyId;

  // Download the Spotify cover (overwrites existing CAA cover)
  const downloaded = await downloadCover(result.coverUrl, album.id);

  if (downloaded) {
    const hadCover = !!album.coverPath;
    album.coverPath = `images/covers/${album.id}.jpg`;
    if (hadCover) {
      upgraded++;
      console.log(`${prefix} ✓ ${album.title} — upgraded (${result.width}px)`);
    } else {
      newCovers++;
      console.log(`${prefix} ★ ${album.title} — new cover! (${result.width}px)`);
    }
  } else {
    console.log(`${prefix} · ${album.title} — found but download failed`);
  }

  // Spotify rate limit: ~30 req/sec, but be polite
  await sleep(100);

  // Save progress every 50 albums
  if (i % 50 === 49) {
    writeFileSync(DATA_FILE, JSON.stringify(albums, null, 2));
  }
}

writeFileSync(DATA_FILE, JSON.stringify(albums, null, 2));

console.log();
console.log("═══════════════════════════════════════════════════════════════");
console.log(`  Upgraded: ${upgraded}  New covers: ${newCovers}  Not found: ${notFound}  Skipped: ${alreadySpotify}`);
console.log("═══════════════════════════════════════════════════════════════");
