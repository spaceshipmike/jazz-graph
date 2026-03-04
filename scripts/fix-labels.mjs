#!/usr/bin/env node

/**
 * Fix album labels by looking up the earliest release in each release group
 * from MusicBrainz. The initial fetch grabbed reissue labels — this corrects
 * them to the original pressing's label.
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "..", "data", "albums.json");
const UA = "TheJazzGraph/0.1.0 (https://github.com/jazz-graph)";

// Known original labels for albums where we have the mapping already
const KNOWN_LABELS = {
  "Blue Note": true, "Columbia": true, "Impulse!": true, "Prestige": true,
  "Riverside": true, "Atlantic": true, "ECM": true, "Verve": true,
  "EmArcy": true, "Warner Bros.": true, "Mercury": true,
};

// Labels that are definitely reissue/audiophile labels
const REISSUE_LABELS = new Set([
  "Analogue Productions", "Music Matters Ltd.", "Rhino", "Not Now Music",
  "Classic Records", "Giants of Jazz", "Original Recordings Group",
  "LaserLight Jazz", "Jazz Heritage", "Music and Melody", "Essential Jazz Classics",
  "Charly Records", "LIM", "Jazz Wax Records", "Wnts", "Audio Fidelity",
  "Personal Affair", "Venus Records", "Trama", "Back Up", "Classic Compact Discs",
  "Documents", "Wounded Bird Records", "Sepia Tone", "Poll Winners Records",
  "Mobile Fidelity Sound Lab", "Universal Music Group International",
  "Universal Music Special Markets", "BMG Direct Marketing, Inc.",
  "BMG Classics", "Sony Music Commercial Music Group", "Rhino Atlantic",
  "Par Media Music", "Jazz Track", "Metrotone", "Craft Recordings",
]);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.status === 503 || res.status === 429) {
        console.log("  Rate limited, waiting 5s...");
        await sleep(5000);
        continue;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      if (i < retries) await sleep(2000);
    }
  }
  return null;
}

async function getOriginalLabel(rgid) {
  // Get all releases in this release group, sorted by date
  const url = `https://musicbrainz.org/ws/2/release-group/${rgid}?inc=releases+labels&fmt=json`;
  const data = await fetchWithRetry(url);
  if (!data || !data.releases) return null;

  // Sort releases by date to find the earliest
  const sorted = data.releases
    .filter(r => r.date && r["label-info"]?.length > 0)
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));

  if (sorted.length === 0) return null;

  // Get the label from the earliest release
  const earliest = sorted[0];
  const labelInfo = earliest["label-info"]?.[0]?.label;
  return labelInfo?.name || null;
}

// Normalize label names to our canonical set
function normalizeLabel(label) {
  if (!label) return null;
  const map = {
    "impulse! records": "Impulse!",
    "impulse!": "Impulse!",
    "blue note": "Blue Note",
    "blue note records": "Blue Note",
    "columbia records": "Columbia",
    "columbia": "Columbia",
    "cbs": "Columbia",
    "cbs records": "Columbia",
    "prestige records": "Prestige",
    "prestige": "Prestige",
    "new jazz": "Prestige",
    "riverside records": "Riverside",
    "riverside": "Riverside",
    "atlantic records": "Atlantic",
    "atlantic": "Atlantic",
    "ecm records": "ECM",
    "ecm": "ECM",
    "ecm records gmbh": "ECM",
    "verve records": "Verve",
    "verve": "Verve",
    "emarcy": "EmArcy",
    "emarcy records": "EmArcy",
    "warner bros.": "Warner Bros.",
    "warner bros. records": "Warner Bros.",
    "warner jazz": "Warner Bros.",
    "warner jazz france": "Warner Bros.",
    "mercury records": "Mercury",
    "mercury": "Mercury",
    "capitol records": "Capitol",
    "capitol": "Capitol",
    "pacific jazz": "Pacific Jazz",
    "pacific jazz records": "Pacific Jazz",
    "contemporary records": "Contemporary",
    "contemporary": "Contemporary",
    "savoy records": "Savoy",
    "savoy jazz": "Savoy",
    "rca victor": "RCA Victor",
    "rca": "RCA Victor",
    "bethlehem records": "Bethlehem",
    "debut records": "Debut",
    "debut": "Debut",
    "esp-disk": "ESP-Disk'",
    "esp‐disk'": "ESP-Disk'",
    "esp-disk'": "ESP-Disk'",
    "fantasy": "Fantasy",
    "milestone": "Milestone",
    "mainstream records": "Mainstream",
    "roulette": "Roulette",
    "roulette jazz": "Roulette",
    "polydor": "Polydor",
    "a&m records": "A&M",
    "geffen records": "Geffen",
    "nonesuch": "Nonesuch",
    "nonesuch records": "Nonesuch",
    "horizon": "A&M",
    "embryo records": "Atlantic",
    "nemperor records": "Atlantic",
    "delmark records": "Delmark",
    "evidence": "Evidence",
    "grp": "GRP",
    "jcoa records": "JCOA",
    "fmp": "FMP",
    "vogue": "Vogue",
  };
  const key = label.toLowerCase().trim();
  return map[key] || label;
}

const albums = JSON.parse(readFileSync(DATA_FILE, "utf8"));
let fixed = 0;
let alreadyCorrect = 0;
let lookedUp = 0;
let failed = 0;

console.log("═══════════════════════════════════════════════════════════════");
console.log("  Fixing Album Labels — Original Release Lookup");
console.log(`  ${albums.length} albums to check`);
console.log("═══════════════════════════════════════════════════════════════\n");

for (let i = 0; i < albums.length; i++) {
  const album = albums[i];
  const prefix = `[${i + 1}/${albums.length}]`;
  const currentLabel = album.label;

  // Already a known original label?
  if (currentLabel && KNOWN_LABELS[currentLabel]) {
    alreadyCorrect++;
    continue;
  }

  // Needs fixing — either null, reissue label, or unknown
  if (!album.rgid) {
    console.log(`${prefix} ✗ ${album.title} — no release group ID`);
    failed++;
    continue;
  }

  // Look up original label from MusicBrainz
  console.log(`${prefix} Looking up: ${album.title} (current: ${currentLabel || "null"})`);
  const originalLabel = await getOriginalLabel(album.rgid);
  lookedUp++;

  if (originalLabel) {
    const normalized = normalizeLabel(originalLabel);
    if (normalized !== currentLabel) {
      console.log(`  ✓ ${currentLabel || "null"} → ${normalized}`);
      album.label = normalized;
      fixed++;
    } else {
      alreadyCorrect++;
    }
  } else {
    // Try normalizing what we have
    const normalized = normalizeLabel(currentLabel);
    if (normalized !== currentLabel) {
      console.log(`  ✓ Normalized: ${currentLabel} → ${normalized}`);
      album.label = normalized;
      fixed++;
    } else {
      console.log(`  · Could not determine original label`);
      failed++;
    }
  }

  // Rate limit
  await sleep(1100);
}

writeFileSync(DATA_FILE, JSON.stringify(albums, null, 2));

// Final stats
const labelCounts = {};
albums.forEach(a => { const l = a.label || "null"; labelCounts[l] = (labelCounts[l] || 0) + 1; });

console.log("\n═══════════════════════════════════════════════════════════════");
console.log(`  Done: ${fixed} fixed, ${alreadyCorrect} already correct, ${failed} failed`);
console.log(`  Looked up ${lookedUp} albums from MusicBrainz`);
console.log("═══════════════════════════════════════════════════════════════");
console.log("\nLabel distribution:");
Object.entries(labelCounts).sort((a, b) => b[1] - a[1]).forEach(([l, c]) => {
  console.log(`  ${c.toString().padStart(3)} ${l}`);
});
