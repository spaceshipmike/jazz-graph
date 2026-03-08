#!/usr/bin/env node

/**
 * Filter the discography audit manifest to core jazz canon artists.
 * Fixes slug matching to account for artist credit name variations.
 * Outputs a filtered manifest ready for Phase 2 fetch.
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ALBUMS_FILE = join(ROOT, "data", "albums.json");
const MANIFEST_FILE = join(ROOT, "data", "discography-audit.json");
const FILTERED_FILE = join(ROOT, "data", "discography-filtered.json");

function slugify(str) {
  return str.toLowerCase().replace(/['']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Core jazz canon — artists whose discographies we want complete
const CORE = new Set([
  // Titans
  "Miles Davis", "John Coltrane", "Duke Ellington", "Thelonious Monk",
  "Charles Mingus", "Charlie Parker", "Dizzy Gillespie", "Louis Armstrong",
  // Piano
  "Bill Evans", "Herbie Hancock", "McCoy Tyner", "Keith Jarrett",
  "Ahmad Jamal", "Horace Silver", "Bud Powell", "Oscar Peterson",
  "Thelonious Monk", "Chick Corea", "Cecil Taylor", "Dave Brubeck",
  "Sonny Clark", "Red Garland", "Wynton Kelly", "Tommy Flanagan",
  // Saxophone
  "Sonny Rollins", "Wayne Shorter", "Ornette Coleman", "Stan Getz",
  "Dexter Gordon", "Joe Henderson", "Hank Mobley", "Eric Dolphy",
  "Cannonball Adderley", "Jackie McLean", "Art Pepper", "Albert Ayler",
  "Pharoah Sanders", "Lee Konitz",
  // Trumpet
  "Freddie Hubbard", "Lee Morgan", "Blue Mitchell", "Kenny Dorham",
  "Clifford Brown", "Chet Baker", "Donald Byrd", "Woody Shaw",
  "Art Farmer", "Tom Harrell", "Wynton Marsalis",
  // Guitar
  "Wes Montgomery", "Jim Hall", "Kenny Burrell", "Grant Green",
  "John McLaughlin", "Pat Metheny", "John Scofield", "John Abercrombie",
  "Django Reinhardt",
  // Bass
  "Ron Carter", "Charles Mingus", "Paul Chambers", "Charlie Haden",
  "Dave Holland", "Jaco Pastorius", "Stanley Clarke",
  // Drums
  "Art Blakey", "Max Roach", "Elvin Jones", "Tony Williams",
  "Jack DeJohnette", "Roy Haynes", "Billy Cobham", "Philly Joe Jones",
  // Vibes
  "Milt Jackson", "Bobby Hutcherson", "Gary Burton", "Cal Tjader",
  // Vocals
  "Billie Holiday", "Ella Fitzgerald", "Sarah Vaughan",
  // Organ
  "Jimmy Smith",
  // Composers/arrangers/bandleaders
  "Gil Evans", "Oliver Nelson", "Sun Ra", "Carla Bley",
  "Weather Report", "Return to Forever", "Mahavishnu Orchestra",
  // Other essential
  "Sonny Stitt", "Gerry Mulligan", "Paul Desmond",
  "Rahsaan Roland Kirk", "Andrew Hill",
  "Stéphane Grappelli",
]);

// Load data
const albums = JSON.parse(readFileSync(ALBUMS_FILE, "utf8"));
const manifest = JSON.parse(readFileSync(MANIFEST_FILE, "utf8"));

// Build a set of all existing album titles (normalized) per artist for fuzzy matching
// This catches the "Art Blakey" vs "Art Blakey's Jazz Messengers" problem
const existingSlugs = new Set(albums.map(a => a.id));
const existingTitles = new Set(albums.map(a => slugify(a.title)));
const existingByArtist = new Map();
for (const a of albums) {
  // Index by lead artist name
  for (const m of a.lineup) {
    if (m.lead) {
      const key = m.name.toLowerCase();
      if (!existingByArtist.has(key)) existingByArtist.set(key, new Set());
      existingByArtist.get(key).add(slugify(a.title));
    }
  }
  // Also index by album artist field
  const artistKey = a.artist.toLowerCase();
  if (!existingByArtist.has(artistKey)) existingByArtist.set(artistKey, new Set());
  existingByArtist.get(artistKey).add(slugify(a.title));
}

// Filter manifest to core artists
const coreArtists = manifest.artists.filter(a => CORE.has(a.name));
const coreMissing = manifest.missing.filter(m => CORE.has(m.artist));

// For each missing album, check if we actually have it under a different credit
const trulyMissing = [];
let falsePositives = 0;

for (const m of coreMissing) {
  const titleSlug = slugify(m.title);
  const artistSlug = slugify(m.artist);
  const fullSlug = slugify(`${m.artist}-${m.title}`);

  // Check direct slug match
  if (existingSlugs.has(fullSlug)) { falsePositives++; continue; }

  // Check if this artist (by lead credit) already has this title
  const artistTitles = existingByArtist.get(m.artist.toLowerCase());
  if (artistTitles && artistTitles.has(titleSlug)) { falsePositives++; continue; }

  // Check some common artist name variations
  const variations = [
    m.artist,
    m.artist + "'s Jazz Messengers",
    m.artist + " Quintet",
    m.artist + " Quartet",
    m.artist + " Trio",
    "The " + m.artist + " Quintet",
    "The " + m.artist + " Quartet",
    "The " + m.artist + " Trio",
  ];
  let found = false;
  for (const v of variations) {
    const vTitles = existingByArtist.get(v.toLowerCase());
    if (vTitles && vTitles.has(titleSlug)) { found = true; break; }
  }
  if (found) { falsePositives++; continue; }

  trulyMissing.push(m);
}

// Group by artist for the report
const byArtist = new Map();
for (const m of trulyMissing) {
  if (!byArtist.has(m.artist)) byArtist.set(m.artist, []);
  byArtist.get(m.artist).push(m);
}

// Summary
console.log("═══════════════════════════════════════════════════════════════");
console.log("  Filtered Audit — Core Jazz Canon");
console.log("═══════════════════════════════════════════════════════════════\n");

const sorted = [...byArtist.entries()].sort((a, b) => b[1].length - a[1].length);
let totalMissing = 0;

for (const [artist, missing] of sorted) {
  const existing = coreArtists.find(a => a.name === artist);
  const haveCount = existing ? existing.studioAlbums - existing.missing : 0;
  console.log(`${artist}: ${missing.length} missing (${haveCount} in DB)`);
  for (const m of missing.sort((a, b) => (a.year || "9999").localeCompare(b.year || "9999"))) {
    console.log(`    ${m.year || "????"} — ${m.title}`);
  }
  totalMissing += missing.length;
  console.log();
}

console.log("═══════════════════════════════════════════════════════════════");
console.log(`  Core artists:     ${CORE.size}`);
console.log(`  Found on MB:      ${coreArtists.length}`);
console.log(`  False positives:  ${falsePositives} (already had under different credit)`);
console.log(`  Truly missing:    ${totalMissing}`);
console.log(`  Fetch time:       ~${Math.ceil(totalMissing * 2 * 1.1 / 60)} min`);
console.log("═══════════════════════════════════════════════════════════════");

// Write filtered manifest
const filtered = {
  generated: new Date().toISOString(),
  artists: coreArtists,
  missing: trulyMissing,
};
writeFileSync(FILTERED_FILE, JSON.stringify(filtered, null, 2));
console.log(`\nManifest: ${FILTERED_FILE}`);
