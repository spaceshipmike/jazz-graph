#!/usr/bin/env node

/**
 * Slowly upgrade non-Spotify covers with Spotify versions.
 * Designed to run in the background, respecting rate limits.
 *
 * - Only processes albums that have a cover but no spotifyId
 * - Searches Spotify, downloads 640px cover if found
 * - Runs at ~2 req/sec (well under Spotify's limits)
 * - Saves progress periodically so it can be interrupted and resumed
 * - Re-extracts colors and converts to WebP after each batch
 *
 * Usage:
 *   op run --env-file .env -- node scripts/spotify-upgrade-covers.mjs
 *   op run --env-file .env -- node scripts/spotify-upgrade-covers.mjs --batch 100
 *   op run --env-file .env -- node scripts/spotify-upgrade-covers.mjs --dry-run
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_FILE = join(ROOT, "data", "albums.json");
const COVERS_DIR = join(ROOT, "data", "images", "covers");
const PROGRESS_FILE = join(ROOT, "data", ".spotify-upgrade-progress.json");

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const batchIdx = args.indexOf("--batch");
const BATCH_SIZE = batchIdx >= 0 ? parseInt(args[batchIdx + 1], 10) : 200;

if (!DRY_RUN && (!CLIENT_ID || !CLIENT_SECRET)) {
  console.error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET");
  console.error("Run with: op run --env-file .env -- node scripts/spotify-upgrade-covers.mjs");
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
    const retryAfter = parseInt(res.headers.get("retry-after") || "10", 10);
    console.log(`  Rate limited, waiting ${retryAfter}s...`);
    await sleep(retryAfter * 1000);
    return searchAlbum(token, title, artist);
  }

  if (!res.ok) return null;
  const data = await res.json();
  const albums = data.albums?.items;
  if (!albums || albums.length === 0) return null;

  const titleLower = title.toLowerCase();
  const match = albums.find((a) => a.name.toLowerCase() === titleLower) || albums[0];

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

// ─── Progress ────────────────────────────────────────────────────────

function loadProgress() {
  if (existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, "utf8"));
  }
  return { processed: [] };
}

function saveProgressFile(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress));
}

// ─── Main ────────────────────────────────────────────────────────────

const albums = JSON.parse(readFileSync(DATA_FILE, "utf8"));
const progress = loadProgress();
const alreadyProcessed = new Set(progress.processed);

// Find albums with covers but no Spotify ID, skipping already-processed
const candidates = albums.filter(
  (a) => a.coverPath && !a.spotifyId && !alreadyProcessed.has(a.id)
);

console.log("═══════════════════════════════════════════════════════════════");
console.log("  Spotify Cover Upgrade (background-safe)");
console.log(`  ${candidates.length} candidates (${alreadyProcessed.size} previously processed)`);
console.log(`  Batch size: ${BATCH_SIZE}`);
if (DRY_RUN) console.log("  (DRY RUN)");
console.log("═══════════════════════════════════════════════════════════════");
console.log();

const batch = candidates.slice(0, BATCH_SIZE);

if (batch.length === 0) {
  console.log("Nothing to upgrade.");
  process.exit(0);
}

let token = DRY_RUN ? null : await getAccessToken();
if (!DRY_RUN) console.log("✓ Authenticated with Spotify\n");

let upgraded = 0;
let notFound = 0;
let tokenAge = Date.now();

for (let i = 0; i < batch.length; i++) {
  const album = batch[i];
  const prefix = `[${i + 1}/${batch.length}]`;

  // Refresh token every 50 minutes
  if (!DRY_RUN && Date.now() - tokenAge > 50 * 60 * 1000) {
    token = await getAccessToken();
    tokenAge = Date.now();
    console.log("  (token refreshed)");
  }

  if (DRY_RUN) {
    console.log(`${prefix} ${album.artist} — ${album.title}`);
    progress.processed.push(album.id);
    await sleep(10);
    continue;
  }

  const result = await searchAlbum(token, album.title, album.artist);

  if (!result) {
    notFound++;
    // Mark as processed so we don't retry next run
    progress.processed.push(album.id);
    console.log(`${prefix} · ${album.artist} — ${album.title}`);
    await sleep(500);
    continue;
  }

  // Found on Spotify — record the ID
  const albumRef = albums.find((a) => a.id === album.id);
  albumRef.spotifyId = result.spotifyId;

  const downloaded = await downloadCover(result.coverUrl, album.id);
  if (downloaded) {
    upgraded++;
    console.log(`${prefix} ✓ ${album.artist} — ${album.title} (${result.width}px)`);
  } else {
    console.log(`${prefix} · ${album.artist} — ${album.title} (download failed)`);
  }

  progress.processed.push(album.id);

  // Slow pace: ~500ms between requests (2 req/sec)
  await sleep(500);

  // Save every 25
  if (i % 25 === 24) {
    writeFileSync(DATA_FILE, JSON.stringify(albums, null, 2) + "\n");
    saveProgressFile(progress);
  }
}

if (!DRY_RUN) {
  writeFileSync(DATA_FILE, JSON.stringify(albums, null, 2) + "\n");
}
saveProgressFile(progress);

console.log();
console.log("═══════════════════════════════════════════════════════════════");
console.log(`  Upgraded: ${upgraded}  Not on Spotify: ${notFound}`);
console.log(`  Total processed: ${progress.processed.length}`);
console.log(`  Remaining: ${candidates.length - batch.length}`);
console.log("═══════════════════════════════════════════════════════════════");

if (upgraded > 0 && !DRY_RUN) {
  console.log("\nRun post-processing:");
  console.log("  node scripts/extract-colors.mjs && node scripts/optimize-images.mjs");
}
