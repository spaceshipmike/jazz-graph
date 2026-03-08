#!/usr/bin/env node

/**
 * Fetch metadata for specific artists not yet in albums.json.
 * Usage: node scripts/fetch-artists.mjs "Django Reinhardt" "Stéphane Grappelli"
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUTPUT_FILE = join(ROOT, "data", "albums.json");
const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "TheJazzGraph/0.1.0 (https://github.com/jazz-graph)";

const artists = process.argv.slice(2);
if (artists.length === 0) { console.log("Usage: node fetch-artists.mjs 'Artist 1' 'Artist 2'"); process.exit(1); }

let lastReq = 0;
async function mbFetch(url) {
  const wait = Math.max(0, 1100 - (Date.now() - lastReq));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastReq = Date.now();
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (res.status === 503 || res.status === 429) {
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
    "lead vocals": "vocals", "vocal": "vocals",
  };
  return map[i] || i;
}

// Filter seeds to only requested artists
const seeds = JSON.parse(readFileSync(join(__dirname, "seed-albums.json"), "utf8"));
const albums = JSON.parse(readFileSync(OUTPUT_FILE, "utf8"));
const existingIds = new Set(albums.map(a => a.id));
const artistSet = new Set(artists.map(a => a.toLowerCase()));

const targetSeeds = seeds.filter(s => artistSet.has(s.artist.toLowerCase()));
const newSeeds = targetSeeds.filter(s => !existingIds.has(slugify(`${s.artist}-${s.title}`)));

console.log(`Fetching ${newSeeds.length} albums for: ${artists.join(", ")}\n`);

let added = 0, failed = 0;
for (let i = 0; i < newSeeds.length; i++) {
  const seed = newSeeds[i];
  const slug = slugify(`${seed.artist}-${seed.title}`);
  console.log(`[${i + 1}/${newSeeds.length}] ${seed.artist} — ${seed.title}`);

  try {
    const query = encodeURIComponent(`release:"${seed.title}" AND artist:"${seed.artist}"`);
    const searchRes = await mbFetch(`${MB_BASE}/release/?query=${query}&fmt=json&limit=5`);
    const searchData = await searchRes.json();
    if (!searchData.releases?.length) { console.log("  ✗ Not found"); failed++; continue; }

    const mb = searchData.releases.find(r => r.title.toLowerCase() === seed.title.toLowerCase()) || searchData.releases[0];
    console.log(`  ✓ ${mb.title} (${mb.date || "?"})`);

    const detailRes = await mbFetch(`${MB_BASE}/release/${mb.id}?inc=artist-credits+recordings+recording-level-rels+artist-rels&fmt=json`);
    const details = await detailRes.json();

    const creditedArtist = mb["artist-credit"]?.[0]?.name || seed.artist;
    const lineup = [];
    const seen = new Set();

    function extract(rels) {
      for (const rel of rels || []) {
        if (["instrument", "vocal", "performer"].includes(rel.type)) {
          const name = rel.artist?.name;
          const instrument = rel.attributes?.[0] || rel.type;
          if (name && !seen.has(name)) { seen.add(name); lineup.push({ name, instrument: normalizeInstrument(instrument), lead: name === creditedArtist }); }
        }
      }
    }

    extract(details?.relations);
    if (details?.media) for (const m of details.media) for (const t of m.tracks || []) extract(t.recording?.relations);
    if (!lineup.length) lineup.push({ name: creditedArtist, instrument: "unknown", lead: true });
    if (!lineup.some(m => m.lead)) {
      const leader = lineup.find(m => m.name === creditedArtist);
      if (leader) leader.lead = true;
      else lineup.unshift({ name: creditedArtist, instrument: "leader", lead: true });
    }

    let year = null;
    const rgId = mb["release-group"]?.id;
    if (rgId) {
      try {
        const rg = await (await mbFetch(`${MB_BASE}/release-group/${rgId}?fmt=json`)).json();
        if (rg["first-release-date"]) year = parseInt(rg["first-release-date"].slice(0, 4), 10);
      } catch {}
    }
    if (!year && mb.date) year = parseInt(mb.date.slice(0, 4), 10);

    const album = {
      id: slug,
      title: mb.title || seed.title,
      artist: creditedArtist,
      year,
      label: mb["label-info"]?.[0]?.label?.name || null,
      coverPath: null,
      mbid: mb.id,
      rgid: rgId,
      lineup,
    };

    if (!existingIds.has(album.id)) {
      albums.push(album);
      existingIds.add(album.id);
      added++;
    }
  } catch (e) {
    console.log(`  ✗ Error: ${e.message}`);
    failed++;
  }
}

writeFileSync(OUTPUT_FILE, JSON.stringify(albums, null, 2));
console.log(`\nDone: +${added} albums (${failed} failed). Total: ${albums.length}`);
console.log("Next: npm run fetch-spotify-covers && npm run fetch-covers && npm run extract-colors");
