#!/usr/bin/env node

/**
 * Manual label corrections for albums where MusicBrainz returned reissue labels.
 * These are well-known original pressing labels from discographical research.
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "..", "data", "albums.json");

// Map: partial title match (lowercased) → { artist match (optional), label }
// Artist match is used when title alone is ambiguous (e.g., two "Undercurrent" albums)
const CORRECTIONS = [
  // Blue Note originals
  { title: "blue train", label: "Blue Note" },
  { title: "maiden voyage", label: "Blue Note" },
  { title: "moanin'", label: "Blue Note" },
  { title: "somethin' else", label: "Blue Note" },
  { title: "out to lunch", label: "Blue Note" },
  { title: "takin' off", label: "Blue Note" },
  { title: "juju", label: "Blue Note" },
  { title: "hub-tones", label: "Blue Note" },
  { title: "misterioso", artist: "monk", label: "Riverside" },
  { title: "cool struttin'", label: "Blue Note" },
  { title: "green street", label: "Blue Note" },
  { title: "matador", label: "Blue Note" },
  { title: "iron man", label: "Blue Note" },
  { title: "black fire", label: "Blue Note" },
  { title: "no room for squares", label: "Blue Note" },
  { title: "one step beyond", label: "Blue Note" },
  { title: "basra", label: "Blue Note" },
  { title: "the tokyo blues", label: "Blue Note" },
  { title: "blowin' the blues away", label: "Blue Note" },
  { title: "a night at birdland", label: "Blue Note" },

  // Columbia originals
  { title: "time out", label: "Columbia" },
  { title: "head hunters", label: "Columbia" },
  { title: "in a silent way", label: "Columbia" },
  { title: "nefertiti", label: "Columbia" },
  { title: "crossings", label: "Warner Bros." },
  { title: "milestones", label: "Columbia" },
  { title: "filles de kilimanjaro", label: "Columbia" },
  { title: "my funny valentine", label: "Columbia" },
  { title: "changes one", label: "Atlantic" },
  { title: "changes two", label: "Atlantic" },
  { title: "town hall concert", label: "Fantasy" },

  // Prestige originals
  { title: "relaxin' with the miles davis", label: "Prestige" },
  { title: "cookin' with the miles davis", label: "Prestige" },
  { title: "coltrane", artist: "coltrane", label: "Prestige" },

  // Impulse! originals
  { title: "ballads", artist: "coltrane", label: "Impulse!" },
  { title: "africa/brass", label: "Impulse!" },
  { title: "impressions", label: "Impulse!" },

  // Atlantic originals
  { title: "the shape of jazz to come", label: "Atlantic" },
  { title: "free jazz", label: "Atlantic" },
  { title: "blues & roots", label: "Atlantic" },
  { title: "mingus mingus mingus", label: "Impulse!" },
  { title: "the clown", label: "Atlantic" },
  { title: "this is our music", label: "Atlantic" },
  { title: "new york eye and ear control", label: "ESP-Disk'" },
  { title: "light as a feather", label: "Polydor" },
  { title: "spectrum", label: "Atlantic" },

  // Riverside originals
  { title: "waltz for debby", label: "Riverside" },
  { title: "undercurrent", artist: "evans", label: "United Artists" },
  { title: "undercurrent", artist: "hall", label: "United Artists" },
  { title: "full house", label: "Riverside" },
  { title: "monk, alone in paris", label: "Vogue" },

  // Verve originals
  { title: "ella and louis", label: "Verve" },
  { title: "black, brown and beige", label: "Columbia" },
  { title: "such sweet thunder", label: "Columbia" },
  { title: "the far east suite", label: "RCA Victor" },
  { title: "sarah vaughan with clifford brown", label: "EmArcy" },
  { title: "dizzy atmosphere", label: "Verve" },

  // Various originals
  { title: "the inner mounting flame", label: "Columbia" },
  { title: "offramp", label: "ECM" },
  { title: "my song", label: "ECM" },
  { title: "facing you", label: "ECM" },
  { title: "spiritual unity", label: "ESP-Disk'" },
  { title: "charlie parker with strings", label: "Mercury" },
  { title: "jazz at massey hall", label: "Debut" },
  { title: "now's the time", label: "Verve" },
  { title: "the bridge", label: "RCA Victor" },
  { title: "quiet kenny", label: "Prestige" },
  { title: "gettin' around", label: "Blue Note" },
  { title: "sweet rain", label: "Verve" },
  { title: "tones for joan's bones", label: "Vortex" },
  { title: "chet", artist: "baker", label: "Riverside" },
  { title: "lady sings the blues", label: "Verve" },
  { title: "the majesty of the blues", label: "Columbia" },
  { title: "we insist", label: "Candid" },
  { title: "drums unlimited", label: "Atlantic" },
  { title: "out of the afternoon", label: "Impulse!" },
  { title: "where?", artist: "carter", label: "Prestige" },
];

const albums = JSON.parse(readFileSync(DATA_FILE, "utf8"));
let fixed = 0;

for (const album of albums) {
  const tl = album.title.toLowerCase();
  const al = album.artist.toLowerCase();

  for (const c of CORRECTIONS) {
    if (tl.includes(c.title)) {
      // If artist constraint, check it
      if (c.artist && !al.includes(c.artist)) continue;

      if (album.label !== c.label) {
        console.log(`${album.label || "null"} → ${c.label}  |  ${album.artist} — ${album.title}`);
        album.label = c.label;
        fixed++;
      }
      break;
    }
  }
}

writeFileSync(DATA_FILE, JSON.stringify(albums, null, 2));

// Final distribution
const labelCounts = {};
albums.forEach(a => { const l = a.label || "null"; labelCounts[l] = (labelCounts[l] || 0) + 1; });

console.log(`\nDone: ${fixed} labels fixed`);
console.log("\nLabel distribution:");
Object.entries(labelCounts).sort((a, b) => b[1] - a[1]).forEach(([l, c]) => {
  console.log(`  ${c.toString().padStart(3)} ${l}`);
});
