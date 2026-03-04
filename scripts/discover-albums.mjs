#!/usr/bin/env node

/**
 * Discover additional albums from top artists in the collection.
 *
 * Queries MusicBrainz for each top artist's release groups (studio + live),
 * filters out bootlegs and duplicates, outputs new seed entries.
 *
 * Usage:
 *   node scripts/discover-albums.mjs              # preview new albums
 *   node scripts/discover-albums.mjs --apply      # append to seed-albums.json
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SEED_FILE = join(__dirname, "seed-albums.json");
const ALBUMS_FILE = join(ROOT, "data", "albums.json");

const APPLY = process.argv.includes("--apply");

const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "TheJazzGraph/0.1.0 (https://github.com/jazz-graph)";

// Discover all unique credited artists from the current dataset
function getArtistsFromDataset(albums) {
  const artists = new Map();
  for (const a of albums) {
    if (!artists.has(a.artist)) artists.set(a.artist, 0);
    artists.set(a.artist, artists.get(a.artist) + 1);
  }
  // Sort by album count descending
  return [...artists.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

// Will be populated from data
let TOP_ARTISTS = [];

let lastRequest = 0;

async function mbFetch(url) {
  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - lastRequest));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });

  if (res.status === 503 || res.status === 429) {
    console.log("  Rate limited, waiting 5s...");
    await new Promise((r) => setTimeout(r, 5000));
    return mbFetch(url);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function searchArtist(name) {
  // Strip common group suffixes for better MB matching
  const searchName = name
    .replace(/\s*&\s*The\s+.*$/i, "")
    .replace(/\s+Quintet$/i, "")
    .replace(/\s+Quartet$/i, "")
    .replace(/\s+Trio$/i, "")
    .replace(/\s+Sextet$/i, "")
    .replace(/\s+Orchestra$/i, "")
    .trim();

  const q = encodeURIComponent(`artist:"${searchName}"`);
  const url = `${MB_BASE}/artist?query=${q}&limit=5&fmt=json`;
  const data = await mbFetch(url);
  const artists = data.artists || [];
  // Prefer exact match on original or search name
  const exact = artists.find((a) =>
    a.name.toLowerCase() === name.toLowerCase() ||
    a.name.toLowerCase() === searchName.toLowerCase()
  );
  return exact || artists[0];
}

async function getArtistReleaseGroups(mbid) {
  const all = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const url = `${MB_BASE}/release-group?artist=${mbid}&type=album&limit=${limit}&offset=${offset}&fmt=json`;
    const data = await mbFetch(url);
    const rgs = data["release-groups"] || [];
    all.push(...rgs);
    if (all.length >= (data["release-group-count"] || 0) || rgs.length < limit) break;
    offset += limit;
  }

  return all;
}

function normalize(str) {
  return str.toLowerCase().replace(/[''""]/g, "'").replace(/[^a-z0-9']/g, " ").replace(/\s+/g, " ").trim();
}

// Filter out bootleg-ish live albums (keep only well-known/official ones)
function isLikelyBootleg(title, year, firstReleaseYear) {
  const t = title.toLowerCase();
  // Released much later than the performance date in title = bootleg
  if (firstReleaseYear && year) {
    const titleYearMatch = title.match(/\b(19\d{2}|20[01]\d)\b/);
    if (titleYearMatch) {
      const perfYear = parseInt(titleYearMatch[1], 10);
      if (firstReleaseYear - perfYear > 15) return true;
    }
  }
  // Common bootleg patterns
  if (/\bcomplete\b.*\bconcert/i.test(t)) return true;
  if (/\bvol(ume)?\.?\s*[2-9]/i.test(t) && /live|concert/i.test(t)) return true;
  if (/\bpart\s*[2-9]/i.test(t)) return true;
  if (/\bunreleased\b/i.test(t)) return true;
  if (/\bbirdland\b/i.test(t) && /\b(19[5-9]\d|200\d)\b/.test(t)) return true;
  return false;
}

async function main() {
  const seeds = JSON.parse(readFileSync(SEED_FILE, "utf8"));
  const albums = JSON.parse(readFileSync(ALBUMS_FILE, "utf8"));
  TOP_ARTISTS = getArtistsFromDataset(albums);
  console.log(`Discovering albums for ${TOP_ARTISTS.length} artists from dataset\n`);

  // Build dedup sets
  const existingKeys = new Set();
  for (const s of seeds) existingKeys.add(normalize(s.title));
  for (const a of albums) existingKeys.add(normalize(a.title));

  const newSeeds = [];

  for (const artistName of TOP_ARTISTS) {
    console.log(`\nSearching: ${artistName}...`);

    const artist = await searchArtist(artistName);
    if (!artist) {
      console.log(`  Could not find artist on MusicBrainz`);
      continue;
    }
    console.log(`  Found: ${artist.name} (${artist.id})`);

    const releaseGroups = await getArtistReleaseGroups(artist.id);
    let added = 0;

    for (const rg of releaseGroups) {
      const primaryType = rg["primary-type"];
      const secondaryTypes = rg["secondary-type-list"] || rg["secondary-types"] || [];

      if (primaryType !== "Album") continue;

      // Skip compilations, remixes, soundtracks, etc.
      const bad = ["Compilation", "Remix", "DJ-mix", "Demo", "Soundtrack", "Mixtape/Street"];
      if (secondaryTypes.some((t) => bad.includes(t))) continue;

      const isLive = secondaryTypes.includes("Live");
      const title = rg.title;
      const firstDate = rg["first-release-date"] || "";
      const year = parseInt(firstDate?.slice(0, 4), 10);

      // Must have a year in jazz range
      if (!year || year < 1945 || year > 2010) continue;

      // Skip live albums entirely
      if (isLive) continue;

      // Skip if already in seed/albums
      if (existingKeys.has(normalize(title))) continue;

      // Use the original credited name from the dataset
      let creditName = artistName;

      newSeeds.push({ title, artist: creditName, year, isLive });
      existingKeys.add(normalize(title));
      added++;

      const tag = isLive ? " [live]" : "";
      console.log(`  + ${title} (${year})${tag}`);
    }

    console.log(`  → ${added} new albums`);
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Total: ${newSeeds.length} new albums discovered`);

  if (newSeeds.length === 0) {
    console.log("Nothing new to add!");
    return;
  }

  // Sort by artist then year
  newSeeds.sort((a, b) => a.artist.localeCompare(b.artist) || a.year - b.year);

  // Summary by artist
  const byCreditedArtist = {};
  for (const s of newSeeds) {
    byCreditedArtist[s.artist] = (byCreditedArtist[s.artist] || 0) + 1;
  }
  console.log("\nBy artist:");
  for (const [a, c] of Object.entries(byCreditedArtist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c.toString().padStart(3)}  ${a}`);
  }

  const studioCount = newSeeds.filter((s) => !s.isLive).length;
  const liveCount = newSeeds.filter((s) => s.isLive).length;
  console.log(`\n  Studio: ${studioCount}  Live: ${liveCount}`);

  if (APPLY) {
    const seedEntries = newSeeds.map((s) => ({ title: s.title, artist: s.artist }));
    const updatedSeeds = [...seeds, ...seedEntries];
    writeFileSync(SEED_FILE, JSON.stringify(updatedSeeds, null, 2) + "\n");
    console.log(`\nAppended ${seedEntries.length} entries to seed-albums.json (total: ${updatedSeeds.length})`);
    console.log(`\nNext steps:`);
    console.log(`  1. Review seed-albums.json and remove any unwanted entries`);
    console.log(`  2. Run: node scripts/fetch-data.mjs`);
    console.log(`  3. Run fix scripts: fix-dates, fix-labels, fix-leads, clean-data`);
  } else {
    console.log(`\nDry run — run with --apply to add to seed-albums.json`);
  }
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
