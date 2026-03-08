#!/usr/bin/env node

/**
 * Filter the rebuild browse catalog to remove reissues, repackagings,
 * and posthumous compilations disguised as albums.
 *
 * Reads .rebuild-progress.json, filters the catalog, writes it back.
 * Run between --browse and the full fetch.
 *
 * Usage:
 *   node scripts/filter-catalog.mjs          # filter + report
 *   node scripts/filter-catalog.mjs --dry    # report only, don't modify
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PROGRESS_FILE = join(ROOT, "data", ".rebuild-progress.json");
const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "TheJazzGraph/0.1.0 (https://github.com/jazz-graph)";

const DRY_RUN = process.argv.includes("--dry");

let lastReq = 0;
async function mbFetch(url) {
  const wait = Math.max(0, 1100 - (Date.now() - lastReq));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastReq = Date.now();
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (res.status === 503 || res.status === 429) {
    await new Promise(r => setTimeout(r, 5000));
    return mbFetch(url);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

// ─── Artist lifespans ────────────────────────────────────────────────

async function fetchArtistLifespan(artistMbid) {
  const url = `${MB_BASE}/artist/${artistMbid}?fmt=json`;
  const res = await mbFetch(url);
  const data = await res.json();
  const begin = data["life-span"]?.begin?.slice(0, 4);
  const end = data["life-span"]?.end?.slice(0, 4);
  const isGroup = data.type === "Group";
  return {
    name: data.name,
    born: begin ? parseInt(begin, 10) : null,
    died: end ? parseInt(end, 10) : null,
    isGroup,
  };
}

// ─── Title-based filters ─────────────────────────────────────────────

const REISSUE_PATTERNS = [
  /\bcomplete\s+(session|recording|original)/i,
  /\bremaster(ed)?\b/i,
  /\bbest\s+of\b(?!\s+(lerner|rodgers|cole|gershwin|johnny|harold|jerome|irving))/i,
  /\bgreatest\s+hits\b/i,
  /\bhit\s+collection\b/i,
  /\bjazz\s+masters\b/i,
  /\bgold\s+collection\b/i,
  /\boriginal\s+jazz\s+classics\b/i,
  /\brising\s+sun\s+collection\b/i,
  /\bjazz\s+round\s+midnight\b/i,
  /\bgrandi\s+del\s+jazz\b/i,
  /\briverside\s+profiles\b/i,
  /\bthe\s+hits\b$/i,
  /\bsignature\b$/i,
  /\bcool\s+and\s+iconic\b/i,
  /\bfinest\b$/i,
  /\bsings\s+sessions\b$/i,
  /\bsesjun\s+radio\b/i,
  /\bvol\.\s*\d+\s*\(remastered\)/i,
  /\(remastered\s+\d{4}\)/i,
];

function looksLikeReissue(title) {
  return REISSUE_PATTERNS.some(re => re.test(title));
}

// ─── Duplicate title detection ───────────────────────────────────────

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, "")  // remove parentheticals
    .replace(/[''""]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  const progress = JSON.parse(readFileSync(PROGRESS_FILE, "utf8"));
  const catalog = progress.catalog;

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Catalog Filter");
  console.log(`  ${catalog.length} albums before filtering`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Group by artist to fetch lifespans efficiently
  const byArtist = new Map();
  for (const entry of catalog) {
    const key = entry.artistMbid || entry.artist;
    if (!byArtist.has(key)) byArtist.set(key, { name: entry.artist, mbid: entry.artistMbid, albums: [] });
    byArtist.get(key).albums.push(entry);
  }

  // Fetch lifespans for artists that have mbids
  console.log("Fetching artist lifespans...\n");
  const lifespans = new Map(); // artist name → { died, cutoff }
  const mbidsSeen = new Set();

  for (const [key, group] of byArtist) {
    if (!group.mbid || mbidsSeen.has(group.mbid)) continue;
    mbidsSeen.add(group.mbid);

    try {
      const life = await fetchArtistLifespan(group.mbid);
      let cutoff = null;
      if (life.died) {
        cutoff = life.died + 10;
      } else if (life.isGroup && life.born) {
        // For active groups, no cutoff
        cutoff = null;
      }
      lifespans.set(group.mbid, { name: life.name, died: life.died, cutoff, isGroup: life.isGroup });
    } catch (e) {
      // Skip on error
    }
  }

  console.log(`Fetched lifespans for ${lifespans.size} artists\n`);

  // Apply filters
  const kept = [];
  const removed = { lifespan: [], reissueTitle: [], dupTitle: [], total: 0 };

  for (const [key, group] of byArtist) {
    const life = lifespans.get(group.mbid);
    const cutoff = life?.cutoff || null;

    // Track normalized titles for duplicate detection within this artist
    const seenTitles = new Map(); // normalized → first entry

    // Sort by year so we keep the earliest release
    const sorted = group.albums.sort((a, b) => (a.year || "9999").localeCompare(b.year || "9999"));

    for (const entry of sorted) {
      const year = entry.year ? parseInt(entry.year, 10) : null;

      // Filter 1: Lifespan cutoff (lifetime + 10 years)
      if (cutoff && year && year > cutoff) {
        removed.lifespan.push(entry);
        continue;
      }

      // Filter 2: Reissue title patterns
      if (looksLikeReissue(entry.title)) {
        removed.reissueTitle.push(entry);
        continue;
      }

      // Filter 3: Duplicate titles (keep earliest)
      const norm = normalizeTitle(entry.title);
      if (seenTitles.has(norm)) {
        removed.dupTitle.push(entry);
        continue;
      }
      seenTitles.set(norm, entry);

      kept.push(entry);
    }
  }

  removed.total = removed.lifespan.length + removed.reissueTitle.length + removed.dupTitle.length;

  // Report
  console.log("─── Removed: Posthumous / post-dissolution ───");
  const lifespanByArtist = new Map();
  for (const e of removed.lifespan) {
    if (!lifespanByArtist.has(e.artist)) lifespanByArtist.set(e.artist, []);
    lifespanByArtist.get(e.artist).push(e);
  }
  for (const [artist, albums] of [...lifespanByArtist.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const life = [...lifespans.values()].find(l => l.name === artist);
    console.log(`  ${artist} (d. ${life?.died || "?"}, cutoff ${life?.cutoff || "?"}): ${albums.length} removed`);
    for (const a of albums.slice(0, 5)) console.log(`    ${a.year} — ${a.title}`);
    if (albums.length > 5) console.log(`    ... and ${albums.length - 5} more`);
  }

  console.log(`\n─── Removed: Reissue/compilation titles ───`);
  for (const e of removed.reissueTitle.slice(0, 20)) {
    console.log(`  ${e.artist} — ${e.title}`);
  }
  if (removed.reissueTitle.length > 20) console.log(`  ... and ${removed.reissueTitle.length - 20} more`);

  console.log(`\n─── Removed: Duplicate titles ───`);
  for (const e of removed.dupTitle.slice(0, 20)) {
    console.log(`  ${e.artist} — ${e.title} (${e.year})`);
  }
  if (removed.dupTitle.length > 20) console.log(`  ... and ${removed.dupTitle.length - 20} more`);

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  Before:           ${catalog.length}`);
  console.log(`  Posthumous:      -${removed.lifespan.length}`);
  console.log(`  Reissue titles:  -${removed.reissueTitle.length}`);
  console.log(`  Duplicate titles:-${removed.dupTitle.length}`);
  console.log(`  After:            ${kept.length}`);
  console.log(`  Fetch time:       ~${Math.ceil(kept.length * 2 * 1.1 / 60)} min (${(kept.length * 2 * 1.1 / 3600).toFixed(1)} hrs)`);
  console.log("═══════════════════════════════════════════════════════════════");

  if (!DRY_RUN) {
    progress.catalog = kept;
    progress.fetchIdx = 0;
    progress.albums = [];
    writeFileSync(PROGRESS_FILE, JSON.stringify(progress));
    console.log("\nCatalog updated. Run: node scripts/rebuild-library.mjs --resume");
  } else {
    console.log("\nDry run — no changes written.");
  }
}

main().catch(e => { console.error("Error:", e); process.exit(1); });
