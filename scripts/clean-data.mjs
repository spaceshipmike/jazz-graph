#!/usr/bin/env node

/**
 * Post-process albums.json to normalize instruments and clean up lineup data.
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "..", "data", "albums.json");

const NORMALIZE = {
  // Drums
  "drums (drum set)": "drums",
  "electronic drum set": "drums",
  "drum set": "drums",
  // Bass
  "acoustic bass guitar": "bass",
  "electric upright bass": "bass",
  "electric bass": "bass",
  "12 string guitar": "guitar",
  // Keys
  "rhodes piano": "electric piano",
  "electronic organ": "organ",
  "keyboard": "keyboards",
  "clavinet": "keyboards",
  "analog synthesizer": "keyboards",
  "synclavier": "keyboards",
  "mellotron": "keyboards",
  "harpsichord": "keyboards",
  "piano accordion": "keyboards",
  // Sax
  "sopranino saxophone": "soprano sax",
  "saxophone": "tenor sax",
  "reeds": "tenor sax",
  // Brass
  "pocket trumpet": "trumpet",
  "valve trombone": "trombone",
  "bass trombone": "trombone",
  // Vocals
  "spoken vocals": "vocals",
  // Percussion
  "cowbell": "percussion",
  "tambourine": "percussion",
  "maracas": "percussion",
  "tabla": "percussion",
  "castanets": "percussion",
  "finger cymbals": "percussion",
  "cymbal": "percussion",
  "steelpan": "percussion",
  "handbell": "percussion",
  "bell": "percussion",
  "membranophone": "percussion",
  "electric sitar": "guitar",
  "slide guitar": "guitar",
  // Strings
  "electric violin": "violin",
  // Winds
  "alto flute": "flute",
  "piccolo": "flute",
  "cor anglais": "oboe",
  "woodwind": "flute",
  "autoharp": "guitar",
  "banjo": "guitar",
  "marímbula": "percussion",
};

// These are not real instruments — remove musicians with only these
const SKIP_INSTRUMENTS = new Set([
  "leader", "performer", "instrument", "guest", "solo",
  "additional", "other instruments", "strings", "brass",
  "unknown",
]);

// Label normalization
const LABEL_NORMALIZE = {
  "impulse!": "Impulse!",
  "ecm records": "ECM",
  "ecm": "ECM",
  "sony records": "Columbia",
  "sony records international": "Columbia",
  "cbs/sony": "Columbia",
  "cbs": "Columbia",
  "legacy": "Columbia",
  "warner bros. records": "Warner Bros.",
  "warner bros": "Warner Bros.",
  "new jazz": "Prestige",
  "original jazz classics": "Prestige",
  "fantasy": "Prestige",
  "capitol records": "Capitol",
  "capitol": "Capitol",
  "rhino": "Rhino",
};

const albums = JSON.parse(readFileSync(DATA_FILE, "utf8"));
let cleaned = 0;
let removed = 0;
let labelsFixed = 0;

for (const album of albums) {
  // Normalize label
  if (album.label) {
    const lk = album.label.toLowerCase();
    if (LABEL_NORMALIZE[lk]) {
      album.label = LABEL_NORMALIZE[lk];
      labelsFixed++;
    }
  }
  const newLineup = [];
  const seen = new Set();

  for (const m of album.lineup) {
    let inst = m.instrument.toLowerCase().trim();

    // Apply normalization
    if (NORMALIZE[inst]) {
      inst = NORMALIZE[inst];
      cleaned++;
    }

    // Skip non-instruments (unless this is the leader)
    if (SKIP_INSTRUMENTS.has(inst) && !m.lead) {
      removed++;
      continue;
    }

    // If leader has a non-instrument, try to keep them but mark unknown
    if (SKIP_INSTRUMENTS.has(inst) && m.lead) {
      inst = "unknown";
    }

    // Deduplicate by name within album
    if (seen.has(m.name)) continue;
    seen.add(m.name);

    newLineup.push({ ...m, instrument: inst });
  }

  album.lineup = newLineup;
}

writeFileSync(DATA_FILE, JSON.stringify(albums, null, 2));

// Report
const insts = new Set();
albums.forEach((a) => a.lineup.forEach((m) => insts.add(m.instrument)));
console.log(`Cleaned ${cleaned} instrument names, removed ${removed} non-instrument entries, fixed ${labelsFixed} labels`);
console.log(`Unique instruments now: ${insts.size}`);
console.log([...insts].sort().join(", "));
