#!/usr/bin/env node

/**
 * Manual date corrections for albums where MusicBrainz returned wrong release groups.
 * These are known original release dates from discographical research.
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "..", "data", "albums.json");

// Manual corrections: title (lowercased partial match) → correct year
const CORRECTIONS = {
  // Wrong release group dates from MusicBrainz
  "undercurrent": 1962,           // Bill Evans & Jim Hall
  "tough": 1966,                  // Art Blakey
  "time out": 1959,               // Dave Brubeck
  "somethin' else": 1958,         // Cannonball Adderley
  "milestones": 1958,             // Miles Davis
  "ballads": 1963,                // John Coltrane
  "heliocentric worlds": 1965,    // Sun Ra
  "lady sings the blues": 1956,   // Billie Holiday
  "trio of doom": 1979,           // McLaughlin/Pastorius/Williams — recorded 1979, released 2007
  "a night at birdland": 1954,    // Art Blakey
  "genius of charlie parker": 1955, // Charlie Parker
  "now's the time": 1957,         // Charlie Parker
  "jim hall live": 1975,          // Jim Hall
  "misterioso": 1958,             // Thelonious Monk
  "night train": 1962,            // Oscar Peterson
  "a night at the village vanguard": 1957, // Sonny Rollins
  "bobby hutcherson collection": null, // compilation — remove
  "moanin'": 1958,                // Art Blakey
  "jaco pastorius": 1976,         // Jaco Pastorius
  "dizzy atmosphere": 1957,       // Dizzy Gillespie
  "free jazz": 1961,              // Ornette Coleman
  "cantaloupe island": null,      // compilation — remove
  "kenny dorham quintet": 1953,   // Kenny Dorham
  "like sonny": 1960,             // John Coltrane
  "sonny side up": 1957,          // Dizzy Gillespie
  "my funny valentine": 1965,     // Miles Davis — live 1964, released 1965
};

// Albums to remove entirely (compilations, posthumous collections, non-original)
const REMOVE_TITLES = [
  "bobby hutcherson collection",
  "cantaloupe island",       // Herbie Hancock compilation
  "tough! / hard bop",       // compilation pairing
  "the sound of the trio / the trio / night train", // compilation pairing
];

const albums = JSON.parse(readFileSync(DATA_FILE, "utf8"));

// Remove compilations
const filtered = albums.filter(a => {
  const tl = a.title.toLowerCase();
  for (const rm of REMOVE_TITLES) {
    if (tl.includes(rm)) {
      console.log(`Removed: ${a.title} (${a.artist}) — compilation/non-original`);
      return false;
    }
  }
  return true;
});

// Apply corrections
let fixed = 0;
for (const album of filtered) {
  const tl = album.title.toLowerCase();
  for (const [key, year] of Object.entries(CORRECTIONS)) {
    if (year === null) continue; // handled by removal
    if (tl.includes(key)) {
      if (album.year !== year) {
        console.log(`Fixed: ${album.title} — ${album.year} → ${year}`);
        album.year = year;
        fixed++;
      }
      break;
    }
  }
}

writeFileSync(DATA_FILE, JSON.stringify(filtered, null, 2));
console.log(`\nDone: ${fixed} dates fixed, ${albums.length - filtered.length} compilations removed, ${filtered.length} albums remaining`);
