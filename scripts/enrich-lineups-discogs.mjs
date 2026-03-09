#!/usr/bin/env node

/**
 * Enrich thin lineups from Discogs.
 * For albums with <=2 lineup members, search Discogs for personnel credits.
 *
 * Usage:
 *   node scripts/enrich-lineups-discogs.mjs
 *   node scripts/enrich-lineups-discogs.mjs --dry-run   # preview only
 *   node scripts/enrich-lineups-discogs.mjs --resume     # skip already-attempted
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_FILE = join(ROOT, "data", "albums.json");
const PROGRESS_FILE = join(ROOT, "data", ".discogs-enrich-progress.json");

const DRY_RUN = process.argv.includes("--dry-run");
const RESUME = process.argv.includes("--resume");
const THRESHOLD = 2; // enrich albums with <= this many lineup members

// ─── Discogs rate limit: 25 req/min unauthenticated ─────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "JazzGraph/0.1 (lineup-enrich)" } }, (res) => {
      if (res.statusCode === 429) {
        resolve({ rateLimited: true });
        return;
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    }).on("error", reject);
  });
}

// ─── Role → instrument mapping ──────────────────────────────────────

const ROLE_MAP = {
  trumpet: "trumpet",
  saxophone: "tenor sax",
  "tenor saxophone": "tenor sax",
  "alto saxophone": "alto sax",
  "baritone saxophone": "baritone sax",
  "soprano saxophone": "soprano sax",
  piano: "piano",
  "electric piano": "electric piano",
  keyboards: "keyboards",
  organ: "organ",
  bass: "bass",
  "double bass": "bass",
  "electric bass": "electric bass",
  "acoustic bass": "bass",
  drums: "drums",
  percussion: "percussion",
  guitar: "guitar",
  "electric guitar": "electric guitar",
  "acoustic guitar": "guitar",
  vibraphone: "vibraphone",
  vibes: "vibraphone",
  trombone: "trombone",
  flugelhorn: "flugelhorn",
  flute: "flute",
  clarinet: "clarinet",
  "bass clarinet": "bass clarinet",
  cornet: "cornet",
  violin: "violin",
  cello: "cello",
  harp: "harp",
  harmonica: "harmonica",
  vocals: "vocals",
  voice: "vocals",
  congas: "congas",
  tuba: "tuba",
  marimba: "marimba",
  xylophone: "xylophone",
  tabla: "tabla",
  sitar: "sitar",
};

function parseRole(role) {
  // Discogs roles can be like "Saxophone, Flute" or "Piano [Electric]"
  const cleaned = role
    .replace(/\[.*?\]/g, "") // remove bracketed notes
    .replace(/\(.*?\)/g, "") // remove parenthetical
    .toLowerCase()
    .trim();

  // Split on comma for multi-instrument credits
  const parts = cleaned.split(",").map((s) => s.trim());
  const instruments = [];

  for (const part of parts) {
    if (ROLE_MAP[part]) {
      instruments.push(ROLE_MAP[part]);
    }
  }

  return instruments;
}

// Non-musician roles to skip
const SKIP_ROLES = new Set([
  "producer",
  "engineer",
  "mastered by",
  "mixed by",
  "remix",
  "lacquer cut by",
  "design",
  "photography by",
  "liner notes",
  "artwork",
  "art direction",
  "cover",
  "written-by",
  "composed by",
  "arranger",
  "arranged by",
  "conductor",
  "technician",
  "executive-producer",
  "a&r",
  "management",
  "supervised by",
  "coordinator",
  "remastered by",
  "compiled by",
  "directed by",
]);

function isMusicalRole(role) {
  const lower = role.toLowerCase().trim();
  for (const skip of SKIP_ROLES) {
    if (lower.includes(skip)) return false;
  }
  return true;
}

// ─── Search + enrich ────────────────────────────────────────────────

async function searchDiscogs(title, artist) {
  const q = encodeURIComponent(`${artist} ${title}`);
  const url = `https://api.discogs.com/database/search?q=${q}&type=master&per_page=3`;

  const result = await fetchJSON(url);
  if (!result || result.rateLimited) return result;
  return result.results?.[0] || null;
}

async function getCredits(masterId) {
  const master = await fetchJSON(`https://api.discogs.com/masters/${masterId}`);
  if (!master || master.rateLimited) return master;

  let credits = master.extraartists || [];

  // If master has no credits, try main release
  if (credits.length === 0 && master.main_release) {
    await sleep(3000);
    const release = await fetchJSON(`https://api.discogs.com/releases/${master.main_release}`);
    if (!release || release.rateLimited) return release;
    credits = release.extraartists || [];
  }

  return credits;
}

function creditsToLineup(credits, existingLeader) {
  const lineup = [];
  const seen = new Set();

  for (const credit of credits) {
    if (!isMusicalRole(credit.role)) continue;

    const instruments = parseRole(credit.role);
    if (instruments.length === 0) continue;

    const name = credit.name
      .replace(/\s*\(\d+\)$/, "") // remove Discogs disambiguation "(2)"
      .trim();

    if (seen.has(name)) continue;
    seen.add(name);

    const isLead = existingLeader && name.toLowerCase() === existingLeader.toLowerCase();

    lineup.push({
      name,
      instrument: instruments[0], // primary instrument
      lead: isLead,
    });
  }

  return lineup;
}

// ─── Safe save: re-read albums.json and merge only lineup changes ───

function saveEnrichedLineups(updatedLineups) {
  // Re-read the current albums.json so we don't overwrite other changes
  const fresh = JSON.parse(readFileSync(DATA_FILE, "utf8"));
  const idIndex = new Map(fresh.map((a, i) => [a.id, i]));

  let merged = 0;
  for (const [id, lineup] of updatedLineups) {
    const idx = idIndex.get(id);
    if (idx !== undefined) {
      fresh[idx].lineup = lineup;
      merged++;
    }
  }

  writeFileSync(DATA_FILE, JSON.stringify(fresh, null, 2) + "\n");
  console.log(`  💾 Saved ${merged} enriched lineups (merged into current albums.json)`);
}

// ─── Main ───────────────────────────────────────────────────────────

const albums = JSON.parse(readFileSync(DATA_FILE, "utf8"));
const pendingLineups = new Map(); // id → lineup (changes to merge on save)

// Load progress for resume
let attempted = new Set();
if (RESUME && existsSync(PROGRESS_FILE)) {
  attempted = new Set(JSON.parse(readFileSync(PROGRESS_FILE, "utf8")));
  console.log(`Resuming — ${attempted.size} albums already attempted`);
}

const thin = albums.filter((a) => a.lineup.length <= THRESHOLD);
const toProcess = RESUME ? thin.filter((a) => !attempted.has(a.id)) : thin;

console.log("═══════════════════════════════════════════════════════════════");
console.log("  Enriching thin lineups from Discogs");
console.log(`  ${toProcess.length} albums to process (${thin.length} total thin of ${albums.length})`);
if (DRY_RUN) console.log("  DRY RUN — no changes will be saved");
console.log("═══════════════════════════════════════════════════════════════\n");

let enriched = 0;
let notFound = 0;
let noCredits = 0;
let errors = 0;

for (let i = 0; i < toProcess.length; i++) {
  const album = toProcess[i];
  const prefix = `[${i + 1}/${toProcess.length}]`;

  // Search Discogs
  const match = await searchDiscogs(album.title, album.artist);

  if (!match) {
    notFound++;
    console.log(`${prefix} · ${album.artist} — ${album.title} (not found)`);
    attempted.add(album.id);
    await sleep(3000);
    continue;
  }

  if (match.rateLimited) {
    console.log(`${prefix} ⏳ Rate limited, waiting 60s...`);
    await sleep(60000);
    i--; // retry
    continue;
  }

  await sleep(3000);

  // Get credits
  const credits = await getCredits(match.id);

  if (!credits || credits.length === 0) {
    noCredits++;
    console.log(`${prefix} · ${album.artist} — ${album.title} (no credits on Discogs)`);
    attempted.add(album.id);
    await sleep(3000);
    continue;
  }

  if (credits.rateLimited) {
    console.log(`${prefix} ⏳ Rate limited, waiting 60s...`);
    await sleep(60000);
    i--; // retry
    continue;
  }

  // Get existing leader name
  const leader = album.lineup.find((m) => m.lead)?.name || album.artist;

  const newLineup = creditsToLineup(credits, leader);

  if (newLineup.length <= album.lineup.length) {
    noCredits++;
    console.log(`${prefix} · ${album.artist} — ${album.title} (Discogs has ${newLineup.length}, we have ${album.lineup.length})`);
    attempted.add(album.id);
    await sleep(3000);
    continue;
  }

  // Ensure leader is present and marked
  if (!newLineup.find((m) => m.lead)) {
    const existing = album.lineup.find((m) => m.lead);
    if (existing) {
      const inNew = newLineup.find((m) => m.name.toLowerCase() === existing.name.toLowerCase());
      if (inNew) {
        inNew.lead = true;
      } else {
        newLineup.unshift(existing);
      }
    }
  }

  enriched++;
  const added = newLineup.length - album.lineup.length;
  console.log(`${prefix} ★ ${album.artist} — ${album.title} (${album.lineup.length} → ${newLineup.length}, +${added})`);

  if (!DRY_RUN) {
    // Stage the lineup change for merge-save
    pendingLineups.set(album.id, newLineup);
    // Also update in-memory so threshold checks stay accurate
    const idx = albums.findIndex((a) => a.id === album.id);
    albums[idx].lineup = newLineup;
  }

  attempted.add(album.id);
  await sleep(3000);

  // Save progress every 25 albums
  if (i % 25 === 24 && !DRY_RUN) {
    saveEnrichedLineups(pendingLineups);
    writeFileSync(PROGRESS_FILE, JSON.stringify([...attempted]));
    pendingLineups.clear();
  }
}

if (!DRY_RUN && pendingLineups.size > 0) {
  saveEnrichedLineups(pendingLineups);
  writeFileSync(PROGRESS_FILE, JSON.stringify([...attempted]));
}

console.log("\n═══════════════════════════════════════════════════════════════");
console.log(`  Enriched: ${enriched}  Not found: ${notFound}  No credits: ${noCredits}  Errors: ${errors}`);
console.log("═══════════════════════════════════════════════════════════════");
