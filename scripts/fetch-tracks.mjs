#!/usr/bin/env node

/**
 * Fetch track listings from MusicBrainz for all albums in albums.json.
 * Adds a `tracks` array to each album: [{ title, position, lengthMs }]
 * Skips albums that already have tracks.
 *
 * Usage:
 *   node scripts/fetch-tracks.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ALBUMS_FILE = join(__dirname, "..", "data", "albums.json");

const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "TheJazzGraph/0.1.0 (https://github.com/jazz-graph)";

let lastRequest = 0;

async function rateLimitedFetch(url) {
  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - lastRequest));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    if (res.status === 503 || res.status === 429) {
      console.log(`  Rate limited (${res.status}), waiting 5s...`);
      await new Promise((r) => setTimeout(r, 5000));
      return rateLimitedFetch(url);
    }
    throw new Error(`HTTP ${res.status}`);
  }
  return res;
}

async function fetchTracks(mbid) {
  const url = `${MB_BASE}/release/${mbid}?inc=recordings&fmt=json`;
  const res = await rateLimitedFetch(url);
  const data = await res.json();

  const tracks = [];
  for (const medium of data.media || []) {
    for (const track of medium.tracks || []) {
      tracks.push({
        title: track.title || track.recording?.title || "Untitled",
        position: track.position,
        lengthMs: track.length || track.recording?.length || null,
      });
    }
  }
  return tracks;
}

async function main() {
  const albums = JSON.parse(readFileSync(ALBUMS_FILE, "utf8"));

  const todo = albums.filter((a) => a.mbid && !a.tracks);
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`  Fetching track listings from MusicBrainz`);
  console.log(`  ${todo.length} albums to fetch (${albums.length - todo.length} already have tracks)`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log();

  let fetched = 0;
  let failed = 0;

  for (let i = 0; i < albums.length; i++) {
    const album = albums[i];
    if (!album.mbid || album.tracks) continue;

    try {
      const tracks = await fetchTracks(album.mbid);
      album.tracks = tracks;
      fetched++;
      console.log(`[${fetched + failed}/${todo.length}] ✓ ${album.artist} — ${album.title} (${tracks.length} tracks)`);
    } catch (e) {
      failed++;
      album.tracks = [];
      console.log(`[${fetched + failed}/${todo.length}] ✗ ${album.title}: ${e.message}`);
    }

    // Save progress every 50 albums
    if ((fetched + failed) % 50 === 0) {
      writeFileSync(ALBUMS_FILE, JSON.stringify(albums, null, 2));
    }
  }

  writeFileSync(ALBUMS_FILE, JSON.stringify(albums, null, 2));

  console.log();
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`  Done: ${fetched} fetched, ${failed} failed`);
  console.log(`═══════════════════════════════════════════════════════════════`);
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
