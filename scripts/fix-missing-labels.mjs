#!/usr/bin/env node

/**
 * Fix missing labels by fetching from MusicBrainz API,
 * and flag bootleg/unofficial releases for removal.
 *
 * Usage:
 *   node scripts/fix-missing-labels.mjs              # fetch + flag
 *   node scripts/fix-missing-labels.mjs --dry-run    # preview only
 *   node scripts/fix-missing-labels.mjs --prune      # also remove flagged bootlegs
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ALBUMS_PATH = join(process.cwd(), "data", "albums.json");
const MB_BASE = "https://musicbrainz.org/ws/2/release";
const UA = "TheJazzGraph/0.1 (jazzgraph@h3r3.com)";
const RATE_MS = 1100; // MB rate limit: 1 req/sec

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const prune = args.includes("--prune");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isBootleg(album) {
  if (!album.year && !album.label) return true;
  const t = (album.title || "").toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return true;
  if (/\bcdr\b|\bbootleg\b|\bunofficial\b/.test(t)) return true;
  // Date-formatted live recordings without year
  if (!album.year && /live (at|in) /i.test(t)) return true;
  return false;
}

async function fetchLabel(mbid, rgid) {
  // Try the specific release first
  const url = `${MB_BASE}/${mbid}?inc=labels&fmt=json`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (res.ok) {
    const data = await res.json();
    const labels = (data["label-info"] || [])
      .map((li) => li.label?.name)
      .filter(Boolean);
    if (labels[0]) return labels[0];
  }

  // Fall back: check sibling releases in the same release-group
  if (!rgid) return null;
  await sleep(RATE_MS);
  const rgUrl = `https://musicbrainz.org/ws/2/release-group/${rgid}?inc=releases&fmt=json`;
  const rgRes = await fetch(rgUrl, { headers: { "User-Agent": UA } });
  if (!rgRes.ok) return null;
  const rgData = await rgRes.json();
  const siblings = (rgData.releases || [])
    .filter((r) => r.id !== mbid)
    .slice(0, 3); // check up to 3 siblings

  for (const sib of siblings) {
    await sleep(RATE_MS);
    const sibUrl = `${MB_BASE}/${sib.id}?inc=labels&fmt=json`;
    const sibRes = await fetch(sibUrl, { headers: { "User-Agent": UA } });
    if (!sibRes.ok) continue;
    const sibData = await sibRes.json();
    const labels = (sibData["label-info"] || [])
      .map((li) => li.label?.name)
      .filter(Boolean);
    if (labels[0]) return labels[0];
  }

  return null;
}

async function main() {
  const albums = JSON.parse(readFileSync(ALBUMS_PATH, "utf-8"));
  const missing = albums.filter((a) => !a.label);

  console.log(`Total albums: ${albums.length}`);
  console.log(`Missing labels: ${missing.length}\n`);

  // Classify
  const bootlegs = missing.filter(isBootleg);
  const recoverable = missing.filter((a) => !isBootleg(a) && a.mbid);
  const unrecoverable = missing.filter((a) => !isBootleg(a) && !a.mbid);

  console.log(`Bootleg/unofficial (flagged): ${bootlegs.length}`);
  console.log(`Recoverable (have mbid): ${recoverable.length}`);
  console.log(`Unrecoverable (no mbid): ${unrecoverable.length}\n`);

  if (bootlegs.length > 0) {
    console.log("── Bootlegs/unofficial ──");
    for (const a of bootlegs.slice(0, 10)) {
      console.log(`  ${a.artist} — ${a.title} (${a.year || "no year"})`);
    }
    if (bootlegs.length > 10) console.log(`  ... and ${bootlegs.length - 10} more`);
    console.log();
  }

  // Fetch labels from MusicBrainz
  let fetched = 0;
  let notFound = 0;

  if (recoverable.length > 0) {
    console.log(`── Fetching labels from MusicBrainz (${recoverable.length} albums) ──`);

    for (let i = 0; i < recoverable.length; i++) {
      const album = recoverable[i];

      if (dryRun) {
        console.log(`  [dry-run] Would fetch: ${album.artist} — ${album.title}`);
        continue;
      }

      const label = await fetchLabel(album.mbid, album.rgid);
      if (label) {
        album.label = label;
        fetched++;
        console.log(`  ✓ ${album.artist} — ${album.title} → ${label}`);
      } else {
        notFound++;
        console.log(`  ✗ ${album.artist} — ${album.title} (no label found)`);
      }

      if (i < recoverable.length - 1) await sleep(RATE_MS);
    }

    console.log(`\nFetched: ${fetched}, Not found: ${notFound}\n`);
  }

  // Prune bootlegs
  let pruned = 0;
  let finalAlbums = albums;

  if (prune && !dryRun) {
    const bootlegIds = new Set(bootlegs.map((a) => a.mbid || a.id));
    finalAlbums = albums.filter((a) => !bootlegIds.has(a.mbid || a.id));
    pruned = albums.length - finalAlbums.length;
    console.log(`Pruned ${pruned} bootleg/unofficial releases`);
  }

  // Write
  if (!dryRun && (fetched > 0 || pruned > 0)) {
    writeFileSync(ALBUMS_PATH, JSON.stringify(finalAlbums, null, 2) + "\n");
    console.log(`\nSaved albums.json (${finalAlbums.length} albums)`);
  }

  // Summary
  const stillMissing = finalAlbums.filter((a) => !a.label).length;
  console.log(`\n── Summary ──`);
  console.log(`Labels recovered: ${fetched}`);
  console.log(`Bootlegs pruned: ${pruned}`);
  console.log(`Still missing labels: ${stillMissing}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
