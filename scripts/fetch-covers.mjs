#!/usr/bin/env node

/**
 * Fetch cover art from Cover Art Archive for all albums in albums.json.
 * Runs with controlled concurrency to respect rate limits.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_FILE = join(ROOT, "data", "albums.json");
const COVERS_DIR = join(ROOT, "data", "images", "covers");
const UA = "TheJazzGraph/0.1.0 (https://github.com/jazz-graph)";

mkdirSync(COVERS_DIR, { recursive: true });

const albums = JSON.parse(readFileSync(DATA_FILE, "utf8"));
let found = 0;
let failed = 0;
let skipped = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchCover(album) {
  const outPath = join(COVERS_DIR, `${album.id}.jpg`);

  // Skip if already downloaded
  if (existsSync(outPath)) {
    skipped++;
    return `images/covers/${album.id}.jpg`;
  }

  // Try release ID first
  for (const id of [album.mbid, album.rgid].filter(Boolean)) {
    const prefix = id === album.rgid ? "release-group" : "release";
    try {
      const url = `https://coverartarchive.org/${prefix}/${id}/front-500`;
      const res = await fetch(url, {
        headers: { "User-Agent": UA },
        redirect: "follow",
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength > 1000) {
          writeFileSync(outPath, buf);
          return `images/covers/${album.id}.jpg`;
        }
      }
    } catch {}
  }

  return null;
}

console.log("═══════════════════════════════════════════════════════════════");
console.log("  Fetching Cover Art from Cover Art Archive");
console.log(`  ${albums.length} albums to check`);
console.log("═══════════════════════════════════════════════════════════════");
console.log();

for (let i = 0; i < albums.length; i++) {
  const album = albums[i];
  const prefix = `[${i + 1}/${albums.length}]`;

  const coverPath = await fetchCover(album);

  if (coverPath) {
    if (album.coverPath !== coverPath) {
      album.coverPath = coverPath;
      found++;
      console.log(`${prefix} ✓ ${album.title}`);
    } else {
      console.log(`${prefix} · ${album.title} (cached)`);
    }
  } else {
    failed++;
    console.log(`${prefix} ✗ ${album.title}`);
  }

  // Rate limit: ~1 req/sec for CAA
  if (i < albums.length - 1) await sleep(600);
}

// Save updated album data with cover paths
writeFileSync(DATA_FILE, JSON.stringify(albums, null, 2));

console.log();
console.log("═══════════════════════════════════════════════════════════════");
console.log(`  Found: ${found}  Cached: ${skipped}  Failed: ${failed}`);
console.log("═══════════════════════════════════════════════════════════════");
