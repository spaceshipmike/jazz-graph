#!/usr/bin/env node

/**
 * The Jazz Graph — Metadata Pipeline
 *
 * Fetches album metadata + personnel from MusicBrainz.
 * Outputs: data/albums.json (metadata only, no images).
 *
 * Cover art is handled separately:
 *   1. fetch-spotify-covers.mjs  — Spotify 640px (primary)
 *   2. fetch-covers.mjs          — Cover Art Archive (fallback)
 *   3. extract-colors.mjs        — dominant color extraction
 *
 * Usage:
 *   node scripts/fetch-data.mjs           # full run
 *   node scripts/fetch-data.mjs --resume  # resume from last progress
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const OUTPUT_FILE = join(DATA_DIR, "albums.json");
const PROGRESS_FILE = join(DATA_DIR, ".fetch-progress.json");

const RESUME = process.argv.includes("--resume");

const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "TheJazzGraph/0.1.0 (https://github.com/jazz-graph)";

// Rate limiting — MusicBrainz allows 1 req/sec
let lastMbRequest = 0;

async function rateLimitedFetch(url) {
  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - lastMbRequest));
  if (wait > 0) await sleep(wait);
  lastMbRequest = Date.now();

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    if (res.status === 503 || res.status === 429) {
      console.log(`  Rate limited (${res.status}), waiting 5s...`);
      await sleep(5000);
      return rateLimitedFetch(url);
    }
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── MusicBrainz Search ───────────────────────────────────────────────

async function searchMbRelease(title, artist) {
  const query = encodeURIComponent(`release:"${title}" AND artist:"${artist}"`);
  const url = `${MB_BASE}/release/?query=${query}&fmt=json&limit=5`;

  try {
    const res = await rateLimitedFetch(url);
    const data = await res.json();
    if (!data.releases || data.releases.length === 0) return null;

    const match = data.releases.find(
      (r) => r.title.toLowerCase() === title.toLowerCase()
    ) || data.releases[0];

    return match;
  } catch (e) {
    console.log(`  MB search failed for "${title}": ${e.message}`);
    return null;
  }
}

async function getMbReleaseGroup(rgId) {
  const url = `${MB_BASE}/release-group/${rgId}?inc=releases&fmt=json`;
  try {
    const res = await rateLimitedFetch(url);
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function getMbRecordingArtists(releaseId) {
  const url = `${MB_BASE}/release/${releaseId}?inc=artist-credits+recordings+recording-level-rels+artist-rels&fmt=json`;
  try {
    const res = await rateLimitedFetch(url);
    return await res.json();
  } catch (e) {
    return null;
  }
}

// ─── Main Pipeline ────────────────────────────────────────────────────

async function processAlbum(seed, index, total) {
  const slug = slugify(`${seed.artist}-${seed.title}`);
  console.log(`[${index + 1}/${total}] ${seed.artist} — ${seed.title}`);

  const mbRelease = await searchMbRelease(seed.title, seed.artist);
  if (!mbRelease) {
    console.log("  ✗ Not found on MusicBrainz");
    return null;
  }

  const releaseId = mbRelease.id;
  const rgId = mbRelease["release-group"]?.id;
  console.log(`  ✓ MB: ${mbRelease.title} (${mbRelease.date || "?"}) [${releaseId}]`);

  // Get detailed release info for personnel
  const details = await getMbRecordingArtists(releaseId);

  // Extract lineup from artist relations
  const lineup = [];
  const seenMusicians = new Set();
  const creditedArtist = mbRelease["artist-credit"]?.[0]?.name || seed.artist;

  function extractRelations(relations) {
    for (const rel of relations || []) {
      if (rel.type === "instrument" || rel.type === "vocal" || rel.type === "performer") {
        const name = rel.artist?.name;
        const instrument = rel.attributes?.[0] || rel.type;
        if (name && !seenMusicians.has(name)) {
          seenMusicians.add(name);
          lineup.push({
            name,
            instrument: normalizeInstrument(instrument),
            lead: name === creditedArtist,
          });
        }
      }
    }
  }

  // Release-level relations
  extractRelations(details?.relations);

  // Recording-level relations
  if (details?.media) {
    for (const medium of details.media) {
      for (const track of medium.tracks || []) {
        extractRelations(track.recording?.relations);
      }
    }
  }

  // Ensure at least the credited artist is present
  if (lineup.length === 0) {
    lineup.push({ name: creditedArtist, instrument: "unknown", lead: true });
  }

  const hasLead = lineup.some((m) => m.lead);
  if (!hasLead) {
    const leader = lineup.find((m) => m.name === creditedArtist);
    if (leader) leader.lead = true;
    else lineup.unshift({ name: creditedArtist, instrument: "leader", lead: true });
  }

  // Extract year — prefer release group first-release-date
  let year = null;
  if (rgId) {
    try {
      const rgData = await getMbReleaseGroup(rgId);
      const firstDate = rgData?.["first-release-date"];
      if (firstDate) year = parseInt(firstDate.slice(0, 4), 10);
    } catch {}
  }
  if (!year && mbRelease.date) {
    year = parseInt(mbRelease.date.slice(0, 4), 10);
  }

  const label = mbRelease["label-info"]?.[0]?.label?.name || seed.label || null;

  return {
    id: slug,
    title: mbRelease.title || seed.title,
    artist: creditedArtist,
    year,
    label,
    coverPath: null,
    mbid: releaseId,
    rgid: rgId,
    lineup,
  };
}

function normalizeInstrument(inst) {
  if (!inst) return "unknown";
  const i = inst.toLowerCase().trim();

  const map = {
    "tenor saxophone": "tenor sax",
    "alto saxophone": "alto sax",
    "soprano saxophone": "soprano sax",
    "baritone saxophone": "baritone sax",
    "double bass": "bass",
    "contrabass": "bass",
    "acoustic bass": "bass",
    "electric bass guitar": "electric bass",
    "bass guitar": "electric bass",
    "drum set": "drums",
    "drumset": "drums",
    "drum kit": "drums",
    "electric guitar": "guitar",
    "acoustic guitar": "guitar",
    "electric piano": "electric piano",
    "rhodes": "electric piano",
    "fender rhodes": "electric piano",
    "synthesizer": "keyboards",
    "organ": "organ",
    "hammond organ": "organ",
    "vibes": "vibraphone",
    "congas": "percussion",
    "bongos": "percussion",
    "timbales": "percussion",
    "flugelhorn": "flugelhorn",
    "french horn": "french horn",
    "lead vocals": "vocals",
    "vocal": "vocals",
    "background vocals": "vocals",
  };

  return map[i] || i;
}

// ─── Run ──────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  The Jazz Graph — Metadata Pipeline");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();

  mkdirSync(DATA_DIR, { recursive: true });

  const seeds = JSON.parse(readFileSync(join(__dirname, "seed-albums.json"), "utf8"));

  // Deduplicate seeds
  const seen = new Set();
  const uniqueSeeds = seeds.filter((s) => {
    const key = `${s.title.toLowerCase()}|${s.artist.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`Seed list: ${uniqueSeeds.length} unique albums`);
  console.log();

  // Load progress if resuming
  let albums = [];
  let startIndex = 0;

  if (RESUME && existsSync(PROGRESS_FILE)) {
    const progress = JSON.parse(readFileSync(PROGRESS_FILE, "utf8"));
    albums = progress.albums || [];
    startIndex = progress.lastIndex + 1;
    console.log(`Resuming from album ${startIndex + 1} (${albums.length} already fetched)`);
    console.log();
  }

  const stats = { found: albums.length, noPersonnel: 0, failed: 0 };

  for (let i = startIndex; i < uniqueSeeds.length; i++) {
    try {
      const album = await processAlbum(uniqueSeeds[i], i, uniqueSeeds.length);
      if (album) {
        albums.push(album);
        stats.found++;
        if (album.lineup.length <= 1) stats.noPersonnel++;
      } else {
        stats.failed++;
      }
    } catch (e) {
      console.log(`  ✗ Error: ${e.message}`);
      stats.failed++;
    }

    // Save progress every 10 albums
    if (i % 10 === 9) {
      writeFileSync(PROGRESS_FILE, JSON.stringify({ lastIndex: i, albums }, null, 2));
    }
  }

  // Write final output
  writeFileSync(OUTPUT_FILE, JSON.stringify(albums, null, 2));

  // Clean up progress file
  if (existsSync(PROGRESS_FILE)) {
    const { unlinkSync } = await import("fs");
    unlinkSync(PROGRESS_FILE);
  }

  console.log();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Pipeline Complete");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Albums found:      ${stats.found} / ${uniqueSeeds.length}`);
  console.log(`  Missing personnel: ${stats.noPersonnel}`);
  console.log(`  Failed:            ${stats.failed}`);
  console.log(`  Output:            ${OUTPUT_FILE}`);
  console.log();
  console.log("  Next steps:");
  console.log("    1. npm run fetch-spotify-covers  (Spotify 640px art)");
  console.log("    2. npm run fetch-covers           (CAA fallback)");
  console.log("    3. npm run extract-colors          (dominant colors)");
  console.log();
}

main().catch((e) => {
  console.error("Pipeline failed:", e);
  process.exit(1);
});
