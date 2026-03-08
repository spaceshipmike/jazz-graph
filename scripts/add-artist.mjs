#!/usr/bin/env node

/**
 * Add an artist to the Jazz Graph via their MusicBrainz discography.
 *
 * Workflow:
 *   1. Search MusicBrainz for the artist
 *   2. Fetch their full album discography (release groups)
 *   3. Print the list — user picks which to include (or "all")
 *   4. Fetch metadata + lineup for selected albums
 *   5. Merge into albums.json + add to seed-albums.json
 *
 * Usage:
 *   node scripts/add-artist.mjs "Cal Tjader"
 *   node scripts/add-artist.mjs "Cal Tjader" --all        # skip selection, add everything
 *   node scripts/add-artist.mjs "Cal Tjader" --pick 1,3,5 # add specific numbers
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ALBUMS_FILE = join(ROOT, "data", "albums.json");
const SEEDS_FILE = join(__dirname, "seed-albums.json");

const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "TheJazzGraph/0.1.0 (https://github.com/jazz-graph)";

// ─── Rate-limited MusicBrainz fetch ──────────────────────────────────

let lastReq = 0;
async function mbFetch(url) {
  const wait = Math.max(0, 1100 - (Date.now() - lastReq));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastReq = Date.now();
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (res.status === 503 || res.status === 429) {
    console.log("  Rate limited, waiting 5s...");
    await new Promise(r => setTimeout(r, 5000));
    return mbFetch(url);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

function slugify(str) {
  return str.toLowerCase().replace(/['']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizeInstrument(inst) {
  if (!inst) return "unknown";
  const i = inst.toLowerCase().trim();
  const map = {
    "tenor saxophone": "tenor sax", "alto saxophone": "alto sax",
    "soprano saxophone": "soprano sax", "baritone saxophone": "baritone sax",
    "double bass": "bass", "contrabass": "bass", "acoustic bass": "bass",
    "electric bass guitar": "electric bass", "bass guitar": "electric bass",
    "drum set": "drums", "drumset": "drums", "drum kit": "drums",
    "electric guitar": "guitar", "acoustic guitar": "guitar",
    "rhodes": "electric piano", "fender rhodes": "electric piano",
    "synthesizer": "keyboards", "hammond organ": "organ",
    "vibes": "vibraphone", "congas": "percussion", "bongos": "percussion",
    "timbales": "percussion", "lead vocals": "vocals", "vocal": "vocals",
  };
  return map[i] || i;
}

// ─── Step 1: Find artist on MusicBrainz ──────────────────────────────

async function findArtist(name) {
  const query = encodeURIComponent(`artist:"${name}"`);
  const res = await mbFetch(`${MB_BASE}/artist/?query=${query}&fmt=json&limit=5`);
  const data = await res.json();
  if (!data.artists?.length) return null;

  // Prefer exact match
  const exact = data.artists.find(a => a.name.toLowerCase() === name.toLowerCase());
  return exact || data.artists[0];
}

// ─── Step 2: Fetch full discography (release groups) ─────────────────

async function fetchDiscography(artistId) {
  const albums = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const url = `${MB_BASE}/release-group/?artist=${artistId}&type=album&fmt=json&limit=${limit}&offset=${offset}`;
    const res = await mbFetch(url);
    const data = await res.json();
    const groups = data["release-groups"] || [];
    if (groups.length === 0) break;

    for (const rg of groups) {
      albums.push({
        rgid: rg.id,
        title: rg.title,
        year: rg["first-release-date"]?.slice(0, 4) || null,
        type: rg["primary-type"] || "Album",
        secondaryTypes: rg["secondary-types"] || [],
      });
    }

    offset += limit;
    if (offset >= (data["release-group-count"] || 0)) break;
  }

  // Sort by year
  albums.sort((a, b) => (a.year || "9999").localeCompare(b.year || "9999"));
  return albums;
}

// ─── Step 3: Fetch album details from a release group ────────────────

async function fetchAlbumFromRG(rgid, artistName) {
  // Get releases for this release group, pick the first
  const url = `${MB_BASE}/release-group/${rgid}?inc=releases&fmt=json`;
  const res = await mbFetch(url);
  const rg = await res.json();

  const releases = rg.releases || [];
  if (!releases.length) return null;

  const release = releases[0];
  const releaseId = release.id;

  // Get detailed release info
  const detailRes = await mbFetch(
    `${MB_BASE}/release/${releaseId}?inc=artist-credits+recordings+recording-level-rels+artist-rels+labels&fmt=json`
  );
  const details = await detailRes.json();

  const creditedArtist = details["artist-credit"]?.[0]?.name || artistName;
  const lineup = [];
  const seen = new Set();

  function extractRelations(rels) {
    for (const rel of rels || []) {
      if (["instrument", "vocal", "performer"].includes(rel.type)) {
        const name = rel.artist?.name;
        const instrument = rel.attributes?.[0] || rel.type;
        if (name && !seen.has(name)) {
          seen.add(name);
          lineup.push({ name, instrument: normalizeInstrument(instrument), lead: name === creditedArtist });
        }
      }
    }
  }

  extractRelations(details?.relations);
  if (details?.media) {
    for (const m of details.media) {
      for (const t of m.tracks || []) {
        extractRelations(t.recording?.relations);
      }
    }
  }

  if (!lineup.length) lineup.push({ name: creditedArtist, instrument: "unknown", lead: true });
  if (!lineup.some(m => m.lead)) {
    const leader = lineup.find(m => m.name === creditedArtist);
    if (leader) leader.lead = true;
    else lineup.unshift({ name: creditedArtist, instrument: "leader", lead: true });
  }

  let year = null;
  const firstDate = rg["first-release-date"];
  if (firstDate) year = parseInt(firstDate.slice(0, 4), 10);
  if (!year && release.date) year = parseInt(release.date.slice(0, 4), 10);

  const label = details["label-info"]?.[0]?.label?.name || null;

  return {
    id: slugify(`${creditedArtist}-${rg.title}`),
    title: rg.title,
    artist: creditedArtist,
    year,
    label,
    coverPath: null,
    mbid: releaseId,
    rgid: rg.id,
    lineup,
  };
}

// ─── Interactive prompt ──────────────────────────────────────────────

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const flags = args.filter(a => a.startsWith("--"));
  const artistName = args.filter(a => !a.startsWith("--"))[0];

  if (!artistName) {
    console.log("Usage: node scripts/add-artist.mjs \"Artist Name\" [--all] [--pick 1,3,5]");
    process.exit(1);
  }

  const addAll = flags.includes("--all");
  const pickFlag = flags.find(f => f.startsWith("--pick"));
  const pickIdx = args.indexOf("--pick");
  const pickNumbers = pickIdx >= 0 ? args[pickIdx + 1]?.split(",").map(n => parseInt(n, 10)) : null;

  // Load existing data
  const albums = JSON.parse(readFileSync(ALBUMS_FILE, "utf8"));
  const existingIds = new Set(albums.map(a => a.id));
  const seeds = JSON.parse(readFileSync(SEEDS_FILE, "utf8"));
  const existingSeedKeys = new Set(seeds.map(s => `${s.artist.toLowerCase()}|${s.title.toLowerCase()}`));

  // Step 1: Find artist
  console.log(`Searching MusicBrainz for "${artistName}"...`);
  const artist = await findArtist(artistName);
  if (!artist) { console.log("Artist not found."); process.exit(1); }

  console.log(`Found: ${artist.name} (${artist.country || "?"}, ${artist["life-span"]?.begin?.slice(0, 4) || "?"}–${artist["life-span"]?.end?.slice(0, 4) || ""})`);
  console.log(`  MB ID: ${artist.id}\n`);

  // Step 2: Fetch discography
  console.log("Fetching discography...");
  const discography = await fetchDiscography(artist.id);

  // Filter out compilations and secondary types we don't want
  const skipTypes = new Set(["Compilation", "Live", "Remix", "DJ-mix", "Mixtape/Street"]);
  const studioAlbums = discography.filter(d => {
    // Keep albums with no secondary types, or with "Live" if explicitly wanted
    return d.secondaryTypes.length === 0 || !d.secondaryTypes.some(t => skipTypes.has(t));
  });

  // Mark which are already in our DB
  console.log(`\n${artist.name} — ${discography.length} release groups (${studioAlbums.length} studio albums)\n`);

  const displayList = studioAlbums;
  for (let i = 0; i < displayList.length; i++) {
    const d = displayList[i];
    const id = slugify(`${artist.name}-${d.title}`);
    const status = existingIds.has(id) ? " [HAVE]" : "";
    const types = d.secondaryTypes.length ? ` (${d.secondaryTypes.join(", ")})` : "";
    console.log(`  ${String(i + 1).padStart(3)}. ${d.year || "????"} — ${d.title}${types}${status}`);
  }

  // Step 3: Select albums
  let selected;
  if (addAll) {
    selected = displayList.filter(d => !existingIds.has(slugify(`${artist.name}-${d.title}`)));
    console.log(`\nAdding all ${selected.length} new albums.`);
  } else if (pickNumbers) {
    selected = pickNumbers
      .filter(n => n >= 1 && n <= displayList.length)
      .map(n => displayList[n - 1])
      .filter(d => !existingIds.has(slugify(`${artist.name}-${d.title}`)));
    console.log(`\nAdding ${selected.length} selected albums.`);
  } else {
    console.log("\nEnter album numbers to add (comma-separated), 'all' for everything, or 'q' to quit:");
    const answer = await prompt("> ");
    if (answer.toLowerCase() === "q") process.exit(0);
    if (answer.toLowerCase() === "all") {
      selected = displayList.filter(d => !existingIds.has(slugify(`${artist.name}-${d.title}`)));
    } else {
      const nums = answer.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      selected = nums
        .filter(n => n >= 1 && n <= displayList.length)
        .map(n => displayList[n - 1])
        .filter(d => !existingIds.has(slugify(`${artist.name}-${d.title}`)));
    }
    console.log(`\nAdding ${selected.length} new albums.`);
  }

  if (selected.length === 0) { console.log("Nothing to add."); process.exit(0); }

  // Step 4: Fetch details for each selected album
  let added = 0, failed = 0;
  console.log();

  for (let i = 0; i < selected.length; i++) {
    const rg = selected[i];
    console.log(`[${i + 1}/${selected.length}] ${rg.title} (${rg.year || "?"})`);

    try {
      const album = await fetchAlbumFromRG(rg.rgid, artist.name);
      if (!album) { console.log("  ✗ Could not resolve release"); failed++; continue; }

      if (!existingIds.has(album.id)) {
        albums.push(album);
        existingIds.add(album.id);
        added++;
        console.log(`  ✓ ${album.lineup.length} musicians, label: ${album.label || "unknown"}`);
      } else {
        console.log("  · Already in database");
      }

      // Add to seeds if not present
      const seedKey = `${artist.name.toLowerCase()}|${rg.title.toLowerCase()}`;
      if (!existingSeedKeys.has(seedKey)) {
        seeds.push({ title: rg.title, artist: artist.name });
        existingSeedKeys.add(seedKey);
      }
    } catch (e) {
      console.log(`  ✗ Error: ${e.message}`);
      failed++;
    }
  }

  // Step 5: Save
  writeFileSync(ALBUMS_FILE, JSON.stringify(albums, null, 2));
  writeFileSync(SEEDS_FILE, JSON.stringify(seeds, null, 2));

  console.log(`\nDone: +${added} albums (${failed} failed). Total: ${albums.length}`);
  console.log("Next: node scripts/fetch-covers.mjs && node scripts/extract-colors.mjs");
}

main().catch(e => { console.error("Error:", e); process.exit(1); });
