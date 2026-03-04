#!/usr/bin/env node

/**
 * Fix album dates to use original release date from MusicBrainz release groups.
 * The initial fetch grabbed reissue dates — this corrects them using the
 * release group's first-release-date field.
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "..", "data", "albums.json");
const UA = "TheJazzGraph/0.1.0 (https://github.com/jazz-graph)";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getOriginalDate(rgid) {
  const url = `https://musicbrainz.org/ws/2/release-group/${rgid}?fmt=json`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const data = await res.json();
  return data["first-release-date"] || null;
}

const albums = JSON.parse(readFileSync(DATA_FILE, "utf8"));
let fixed = 0;
let unchanged = 0;
let failed = 0;

console.log(`Fixing dates for ${albums.length} albums using release group first-release-date...\n`);

for (let i = 0; i < albums.length; i++) {
  const album = albums[i];
  const prefix = `[${i + 1}/${albums.length}]`;

  if (!album.rgid) {
    console.log(`${prefix} ✗ ${album.title} — no release group ID`);
    failed++;
    await sleep(200);
    continue;
  }

  try {
    const date = await getOriginalDate(album.rgid);
    if (date) {
      const newYear = parseInt(date.slice(0, 4), 10);
      if (newYear !== album.year) {
        console.log(`${prefix} ✓ ${album.title}: ${album.year} → ${newYear}`);
        album.year = newYear;
        fixed++;
      } else {
        unchanged++;
      }
    } else {
      console.log(`${prefix} · ${album.title} — no date found`);
      failed++;
    }
  } catch (e) {
    console.log(`${prefix} ✗ ${album.title} — ${e.message}`);
    failed++;
  }

  // Rate limit: 1 req/sec for MusicBrainz
  await sleep(1100);
}

writeFileSync(DATA_FILE, JSON.stringify(albums, null, 2));

console.log(`\nDone: ${fixed} fixed, ${unchanged} already correct, ${failed} failed`);
