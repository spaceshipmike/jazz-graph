#!/usr/bin/env node

/**
 * Use Discogs API to find labels for albums still missing them.
 * Designed as a post-build pipeline step after MusicBrainz fetch + fix-labels.
 *
 * Usage:
 *   DISCOGS_TOKEN=xxx node scripts/fix-labels-discogs.mjs
 *   DISCOGS_TOKEN=xxx node scripts/fix-labels-discogs.mjs --dry-run
 *   DISCOGS_TOKEN=xxx node scripts/fix-labels-discogs.mjs --prune   # remove albums still unlabeled
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ALBUMS_PATH = join(process.cwd(), "data", "albums.json");
const TOKEN = process.env.DISCOGS_TOKEN;
const UA = "TheJazzGraph/0.1 +https://jazz.h3r3.com";
const RATE_MS = 1100; // Discogs: ~60 req/min for authenticated

if (!TOKEN) {
  console.error("Set DISCOGS_TOKEN env var");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const pruneUnlabeled = process.argv.includes("--prune");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function searchDiscogs(artist, title, year) {
  const params = new URLSearchParams({
    artist,
    release_title: title,
    type: "release",
    per_page: "5",
    token: TOKEN,
  });
  if (year) params.set("year", String(year));

  const url = `https://api.discogs.com/database/search?${params}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });

  if (res.status === 429) {
    console.log("    Rate limited, waiting 30s...");
    await sleep(30000);
    return searchDiscogs(artist, title, year);
  }
  if (!res.ok) return null;

  const data = await res.json();
  const results = data.results || [];

  // Find first result with a label
  for (const r of results) {
    const labels = (r.label || []).filter(
      (l) => l && !l.match(/^(Not On Label|none|unknown|\[no label\])/i)
    );
    if (labels.length > 0) return labels[0];
  }

  // Retry without year if no results
  if (year && results.length === 0) {
    await sleep(RATE_MS);
    return searchDiscogs(artist, title, null);
  }

  return null;
}

async function main() {
  const albums = JSON.parse(readFileSync(ALBUMS_PATH, "utf-8"));
  const missing = albums.filter((a) => !a.label);

  console.log(`Total albums: ${albums.length}`);
  console.log(`Missing labels: ${missing.length}\n`);

  let found = 0;
  let notFound = 0;

  for (let i = 0; i < missing.length; i++) {
    const album = missing[i];
    const tag = `[${i + 1}/${missing.length}]`;

    if (dryRun) {
      console.log(`  ${tag} Would search: ${album.artist} — ${album.title}`);
      continue;
    }

    const label = await searchDiscogs(album.artist, album.title, album.year);

    if (label) {
      album.label = label;
      found++;
      console.log(`  ${tag} ✓ ${album.artist} — ${album.title} → ${label}`);
    } else {
      notFound++;
      console.log(`  ${tag} ✗ ${album.artist} — ${album.title}`);
    }

    if (i < missing.length - 1) await sleep(RATE_MS);
  }

  let finalAlbums = albums;
  let pruned = 0;

  if (pruneUnlabeled && !dryRun) {
    const before = finalAlbums.length;
    finalAlbums = finalAlbums.filter((a) => a.label);
    pruned = before - finalAlbums.length;
    if (pruned > 0) console.log(`\nPruned ${pruned} albums still missing labels`);
  }

  if (!dryRun && (found > 0 || pruned > 0)) {
    writeFileSync(ALBUMS_PATH, JSON.stringify(finalAlbums, null, 2) + "\n");
    console.log(`Saved albums.json (${finalAlbums.length} albums)`);
  }

  const stillMissing = finalAlbums.filter((a) => !a.label).length;
  console.log(`\n── Summary ──`);
  console.log(`Labels found: ${found}`);
  console.log(`Pruned: ${pruned}`);
  console.log(`Not found: ${notFound}`);
  console.log(`Still missing: ${stillMissing}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
