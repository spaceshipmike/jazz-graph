#!/usr/bin/env node

/**
 * Detect and remove reissues/compilations from albums.json.
 *
 * Two-pass approach:
 * 1. Query MusicBrainz for release-group secondary-types (Compilation, Live, etc.)
 * 2. Detect posthumous releases using known artist death dates
 *
 * Outputs a report and optionally removes flagged albums.
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

// Known death years for major artists
const DEATHS = {
  "Charlie Parker": 1955, "Billie Holiday": 1959, "Lester Young": 1959,
  "Eric Dolphy": 1964, "Bud Powell": 1966, "John Coltrane": 1967,
  "Wes Montgomery": 1968, "Coleman Hawkins": 1969, "Ben Webster": 1973,
  "Duke Ellington": 1974, "Cannonball Adderley": 1975, "Paul Desmond": 1977,
  "Charles Mingus": 1979, "Bill Evans": 1980, "Art Pepper": 1982,
  "Thelonious Monk": 1982, "Count Basie": 1984, "Red Garland": 1984,
  "Hank Mobley": 1986, "Benny Goodman": 1986, "Jaco Pastorius": 1987,
  "Chet Baker": 1988, "Woody Shaw": 1989, "Dexter Gordon": 1990,
  "Art Blakey": 1990, "Sarah Vaughan": 1990, "Miles Davis": 1991,
  "Dizzy Gillespie": 1993, "Sun Ra": 1993, "Ella Fitzgerald": 1996,
  "Betty Carter": 1998, "Joe Henderson": 2001, "Jimmy Smith": 2005,
  "Michael Brecker": 2007, "Freddie Hubbard": 2008, "Horace Silver": 2014,
  "Ornette Coleman": 2015, "Bobby Hutcherson": 2016, "McCoy Tyner": 2020,
  "Chick Corea": 2021, "Lee Morgan": 1972, "Kenny Dorham": 1972,
  "Booker Little": 1961, "Clifford Brown": 1956, "Fats Navarro": 1950,
};

// Title patterns that suggest compilations/reissues
// Only applied to albums from 1980+ (pre-1980 "songbook" and "plays" albums are originals)
const COMPILATION_RE = /\b(complete|essential|best of|greatest hits?|collection|anthology|remaster|deluxe|bonus tracks?|4 originals|original sessions?|original recordings?|jazz greats|jazz masters|jazz profile|jazz tribune|jazz studies|star power|indispensable|i grandi del jazz|bd music presents|jazz do it|jazz six pack|columbia jazz|cool and iconic|greatest jazz|cool too|pop classics|big bands?'?s? greatest|gold collection|super session|all my life|first lady of song|reprise years)\b/i;

// Important posthumous releases of previously unreleased recordings — never remove
const KEEP_LIST = new Set([
  "eric-dolphy-other-aspects",                                    // unreleased 1962 recordings, released 1987
  "duke-ellington-his-orchestra-the-afro-eurasian-eclipse",       // recorded 1971, released 1991
  "eric-dolphy-stockholm-sessions",                               // unreleased recordings
  "eric-dolphy-candid-dolphy",                                    // unreleased recordings
]);

const albums = JSON.parse(readFileSync(DATA_FILE, "utf8"));

const dryRun = process.argv.includes("--dry-run");
const mode = process.argv.includes("--remove") ? "remove" : "report";

console.log("=".repeat(65));
console.log("  Detecting reissues & compilations");
console.log(`  ${albums.length} albums | mode: ${mode}${dryRun ? " (dry run)" : ""}`);
console.log("=".repeat(65));
console.log();

const flagged = new Map(); // id -> reasons[]

// Pass 1: Posthumous detection (no API calls needed)
// Only flag albums released 10+ years after death AND from 1980+
console.log("--- Pass 1: Posthumous releases ---\n");
for (const album of albums) {
  if (!album.year || !album.artist) continue;
  if (album.year < 1980) continue; // pre-1980 albums are assumed original
  if (KEEP_LIST.has(album.id)) continue; // manually curated keepers
  for (const [artist, deathYear] of Object.entries(DEATHS)) {
    if (album.artist.includes(artist) && album.year > deathYear + 10) {
      const reasons = flagged.get(album.id) || [];
      reasons.push(`posthumous: ${artist} died ${deathYear}, album released ${album.year} (+${album.year - deathYear}yr)`);
      flagged.set(album.id, reasons);
    }
  }
}
console.log(`  Found ${flagged.size} posthumous releases (>10yr after death, 1980+)\n`);

// Pass 2: Title-based compilation detection (only 1980+)
console.log("--- Pass 2: Compilation title patterns ---\n");
let titleMatches = 0;
for (const album of albums) {
  if (album.year && album.year < 1980) continue; // pre-1980 "songbook" albums are originals
  if (KEEP_LIST.has(album.id)) continue;
  if (COMPILATION_RE.test(album.title)) {
    const reasons = flagged.get(album.id) || [];
    reasons.push(`title match: "${album.title}"`);
    flagged.set(album.id, reasons);
    titleMatches++;
  }
}
console.log(`  Found ${titleMatches} title-pattern matches\n`);

// Pass 3: Query MusicBrainz for secondary types (only for unflagged albums with rgid)
console.log("--- Pass 3: MusicBrainz release-group types ---\n");
let mbChecked = 0, mbFlagged = 0;
const unflagged = albums.filter(a => a.rgid && !flagged.has(a.id));
console.log(`  ${unflagged.length} albums to check via API...\n`);

for (let i = 0; i < unflagged.length; i++) {
  const album = unflagged[i];
  try {
    const url = `https://musicbrainz.org/ws/2/release-group/${album.rgid}?fmt=json`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) {
      const data = await res.json();
      const secondaryTypes = data["secondary-types"] || [];
      const isCompilation = secondaryTypes.some(t =>
        ["Compilation", "DJ-mix", "Mixtape/Street"].includes(t)
      );
      if (isCompilation) {
        const reasons = flagged.get(album.id) || [];
        reasons.push(`MB type: ${secondaryTypes.join(", ")}`);
        flagged.set(album.id, reasons);
        mbFlagged++;
        console.log(`  [${i+1}/${unflagged.length}] COMP ${album.title} — ${secondaryTypes.join(", ")}`);
      } else if (i % 100 === 0) {
        console.log(`  [${i+1}/${unflagged.length}] checking...`);
      }
    }
    mbChecked++;
  } catch (e) {
    // skip
  }
  await sleep(1100); // MusicBrainz rate limit
}
console.log(`\n  Checked ${mbChecked}, flagged ${mbFlagged} compilations\n`);

// Report
console.log("=".repeat(65));
console.log(`  TOTAL FLAGGED: ${flagged.size} of ${albums.length} albums`);
console.log("=".repeat(65));
console.log();

const flaggedAlbums = albums.filter(a => flagged.has(a.id));
flaggedAlbums.sort((a, b) => (b.year || 0) - (a.year || 0));

for (const a of flaggedAlbums) {
  const reasons = flagged.get(a.id);
  console.log(`  ${a.year || "????"} ${a.title.substring(0, 50).padEnd(52)} ${a.artist.substring(0, 25)}`);
  for (const r of reasons) console.log(`         ${r}`);
}

if (mode === "remove" && !dryRun) {
  const kept = albums.filter(a => !flagged.has(a.id));
  writeFileSync(DATA_FILE, JSON.stringify(kept, null, 2));
  console.log(`\nRemoved ${flagged.size} albums. ${kept.length} remaining.`);
} else if (mode === "remove" && dryRun) {
  console.log(`\nDry run: would remove ${flagged.size} albums. Run without --dry-run to apply.`);
} else {
  console.log(`\nReport only. Use --remove to delete flagged albums, or --remove --dry-run to preview.`);
}
