#!/usr/bin/env node

/**
 * Audit all lead artists against their MusicBrainz discographies.
 *
 * Phase 1 (browse): For each lead artist, fetch their MB discography and
 * compare against what we have. Outputs a report + JSON manifest.
 *
 * Phase 2 (fetch): Use the manifest to batch-fetch all missing albums.
 *
 * Usage:
 *   node scripts/audit-discographies.mjs                # Phase 1: browse + report
 *   node scripts/audit-discographies.mjs --fetch        # Phase 2: fetch from manifest
 *   node scripts/audit-discographies.mjs --fetch --max 500  # fetch up to N albums
 *   node scripts/audit-discographies.mjs --resume       # resume interrupted browse/fetch
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ALBUMS_FILE = join(ROOT, "data", "albums.json");
const SEEDS_FILE = join(__dirname, "seed-albums.json");
const MANIFEST_FILE = join(ROOT, "data", "discography-audit.json");
const PROGRESS_FILE = join(ROOT, "data", ".audit-progress.json");

const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "TheJazzGraph/0.1.0 (https://github.com/jazz-graph)";

const args = process.argv.slice(2);
const FETCH_MODE = args.includes("--fetch");
const RESUME = args.includes("--resume");
const maxIdx = args.indexOf("--max");
const MAX_FETCH = maxIdx >= 0 ? parseInt(args[maxIdx + 1], 10) : Infinity;

// ─── Rate-limited MusicBrainz fetch ──────────────────────────────────

let lastReq = 0;
async function mbFetch(url) {
  const wait = Math.max(0, 1100 - (Date.now() - lastReq));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastReq = Date.now();
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (res.status === 503 || res.status === 429) {
    console.log("  ⏳ Rate limited, waiting 5s...");
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

// ─── MusicBrainz helpers ─────────────────────────────────────────────

async function findArtist(name) {
  const query = encodeURIComponent(`artist:"${name}"`);
  const res = await mbFetch(`${MB_BASE}/artist/?query=${query}&fmt=json&limit=5`);
  const data = await res.json();
  if (!data.artists?.length) return null;
  const exact = data.artists.find(a => a.name.toLowerCase() === name.toLowerCase());
  return exact || data.artists[0];
}

async function fetchDiscography(artistId) {
  const albums = [];
  let offset = 0;
  while (true) {
    const url = `${MB_BASE}/release-group/?artist=${artistId}&type=album&fmt=json&limit=100&offset=${offset}`;
    const res = await mbFetch(url);
    const data = await res.json();
    const groups = data["release-groups"] || [];
    if (groups.length === 0) break;
    for (const rg of groups) {
      albums.push({
        rgid: rg.id,
        title: rg.title,
        year: rg["first-release-date"]?.slice(0, 4) || null,
        secondaryTypes: rg["secondary-types"] || [],
      });
    }
    offset += 100;
    if (offset >= (data["release-group-count"] || 0)) break;
  }
  albums.sort((a, b) => (a.year || "9999").localeCompare(b.year || "9999"));
  return albums;
}

async function fetchAlbumFromRG(rgid, artistName) {
  const url = `${MB_BASE}/release-group/${rgid}?inc=releases&fmt=json`;
  const res = await mbFetch(url);
  const rg = await res.json();
  const releases = rg.releases || [];
  if (!releases.length) return null;

  const release = releases[0];
  const detailRes = await mbFetch(
    `${MB_BASE}/release/${release.id}?inc=artist-credits+recordings+recording-level-rels+artist-rels+labels&fmt=json`
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
      for (const t of m.tracks || []) extractRelations(t.recording?.relations);
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

  return {
    id: slugify(`${creditedArtist}-${rg.title}`),
    title: rg.title,
    artist: creditedArtist,
    year,
    label: details["label-info"]?.[0]?.label?.name || null,
    coverPath: null,
    mbid: release.id,
    rgid: rg.id,
    lineup,
  };
}

// ─── Phase 1: Browse ─────────────────────────────────────────────────

async function browsePhase() {
  const albums = JSON.parse(readFileSync(ALBUMS_FILE, "utf8"));
  const existingIds = new Set(albums.map(a => a.id));

  // Get all lead artists
  const leadMap = new Map(); // name → album count
  for (const a of albums) {
    for (const m of a.lineup) {
      if (m.lead) leadMap.set(m.name, (leadMap.get(m.name) || 0) + 1);
    }
  }
  const leadArtists = [...leadMap.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);

  // Load progress if resuming
  let manifest = { generated: new Date().toISOString(), artists: [], missing: [] };
  let startIdx = 0;
  if (RESUME && existsSync(PROGRESS_FILE)) {
    const progress = JSON.parse(readFileSync(PROGRESS_FILE, "utf8"));
    manifest = progress.manifest;
    startIdx = progress.lastIdx + 1;
    console.log(`Resuming from artist ${startIdx + 1}/${leadArtists.length}\n`);
  }

  const skipTypes = new Set(["Compilation", "Live", "Remix", "DJ-mix", "Mixtape/Street"]);

  console.log(`Auditing ${leadArtists.length} lead artists against MusicBrainz\n`);

  for (let i = startIdx; i < leadArtists.length; i++) {
    const name = leadArtists[i];
    const haveCount = leadMap.get(name);
    process.stdout.write(`[${i + 1}/${leadArtists.length}] ${name} (${haveCount} in DB)`);

    try {
      const artist = await findArtist(name);
      if (!artist) { console.log(" — not found on MB"); continue; }

      const disco = await fetchDiscography(artist.id);
      const studio = disco.filter(d => !d.secondaryTypes.some(t => skipTypes.has(t)));

      const missing = studio.filter(d => {
        const id = slugify(`${artist.name}-${d.title}`);
        return !existingIds.has(id);
      });

      const artistEntry = {
        name: artist.name,
        mbid: artist.id,
        totalReleaseGroups: disco.length,
        studioAlbums: studio.length,
        inDb: studio.length - missing.length,
        missing: missing.length,
      };
      manifest.artists.push(artistEntry);

      for (const m of missing) {
        manifest.missing.push({
          artist: artist.name,
          artistMbid: artist.id,
          title: m.title,
          rgid: m.rgid,
          year: m.year,
        });
      }

      if (missing.length > 0) {
        console.log(` — ${studio.length} studio, ${studio.length - missing.length} have, ${missing.length} missing`);
      } else {
        console.log(` — complete (${studio.length})`);
      }
    } catch (e) {
      console.log(` — error: ${e.message}`);
    }

    // Save progress every 5 artists
    if (i % 5 === 4) {
      writeFileSync(PROGRESS_FILE, JSON.stringify({ lastIdx: i, manifest }));
    }
  }

  // Write manifest
  manifest.generated = new Date().toISOString();
  writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  if (existsSync(PROGRESS_FILE)) {
    const { unlinkSync } = await import("fs");
    unlinkSync(PROGRESS_FILE);
  }

  // Summary
  const totalMissing = manifest.missing.length;
  const completeArtists = manifest.artists.filter(a => a.missing === 0).length;
  const incompleteArtists = manifest.artists.filter(a => a.missing > 0);

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  Discography Audit Complete");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Artists audited:    ${manifest.artists.length}`);
  console.log(`  Complete:           ${completeArtists}`);
  console.log(`  Incomplete:         ${incompleteArtists.length}`);
  console.log(`  Missing albums:     ${totalMissing}`);
  console.log(`  Manifest:           ${MANIFEST_FILE}`);

  if (incompleteArtists.length > 0) {
    console.log("\n  Biggest gaps:");
    incompleteArtists.sort((a, b) => b.missing - a.missing);
    for (const a of incompleteArtists.slice(0, 20)) {
      console.log(`    ${a.name}: ${a.inDb}/${a.studioAlbums} (${a.missing} missing)`);
    }
  }

  const fetchCalls = totalMissing * 2;
  console.log(`\n  To fetch all missing: ~${fetchCalls} API calls (~${Math.ceil(fetchCalls * 1.1 / 60)} min)`);
  console.log(`  Run: node scripts/audit-discographies.mjs --fetch`);
}

// ─── Phase 2: Fetch ──────────────────────────────────────────────────

async function fetchPhase() {
  if (!existsSync(MANIFEST_FILE)) {
    console.log("No manifest found. Run without --fetch first to generate one.");
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_FILE, "utf8"));
  const albums = JSON.parse(readFileSync(ALBUMS_FILE, "utf8"));
  const existingIds = new Set(albums.map(a => a.id));
  const seeds = JSON.parse(readFileSync(SEEDS_FILE, "utf8"));
  const existingSeedKeys = new Set(seeds.map(s => `${s.artist.toLowerCase()}|${s.title.toLowerCase()}`));

  const toFetch = manifest.missing.filter(m => {
    const id = slugify(`${m.artist}-${m.title}`);
    return !existingIds.has(id);
  });

  const count = Math.min(toFetch.length, MAX_FETCH);
  console.log(`Fetching ${count} missing albums from manifest (${toFetch.length} total missing)\n`);

  // Load progress if resuming
  let startIdx = 0;
  if (RESUME && existsSync(PROGRESS_FILE)) {
    const progress = JSON.parse(readFileSync(PROGRESS_FILE, "utf8"));
    startIdx = progress.lastIdx + 1;
    console.log(`Resuming from album ${startIdx + 1}\n`);
  }

  let added = 0, failed = 0;

  for (let i = startIdx; i < count; i++) {
    const entry = toFetch[i];
    console.log(`[${i + 1}/${count}] ${entry.artist} — ${entry.title} (${entry.year || "?"})`);

    try {
      const album = await fetchAlbumFromRG(entry.rgid, entry.artist);
      if (!album) { console.log("  ✗ Could not resolve"); failed++; continue; }

      if (!existingIds.has(album.id)) {
        albums.push(album);
        existingIds.add(album.id);
        added++;
        console.log(`  ✓ ${album.lineup.length} musicians`);
      } else {
        console.log("  · Already exists");
      }

      const seedKey = `${entry.artist.toLowerCase()}|${entry.title.toLowerCase()}`;
      if (!existingSeedKeys.has(seedKey)) {
        seeds.push({ title: entry.title, artist: entry.artist });
        existingSeedKeys.add(seedKey);
      }
    } catch (e) {
      console.log(`  ✗ Error: ${e.message}`);
      failed++;
    }

    // Save every 10 albums
    if (i % 10 === 9) {
      writeFileSync(ALBUMS_FILE, JSON.stringify(albums, null, 2));
      writeFileSync(SEEDS_FILE, JSON.stringify(seeds, null, 2));
      writeFileSync(PROGRESS_FILE, JSON.stringify({ lastIdx: i }));
    }
  }

  // Final save
  writeFileSync(ALBUMS_FILE, JSON.stringify(albums, null, 2));
  writeFileSync(SEEDS_FILE, JSON.stringify(seeds, null, 2));
  if (existsSync(PROGRESS_FILE)) {
    const { unlinkSync } = await import("fs");
    unlinkSync(PROGRESS_FILE);
  }

  console.log(`\nDone: +${added} albums (${failed} failed). Total: ${albums.length}`);
  console.log("Next: node scripts/fetch-covers.mjs && node scripts/extract-colors.mjs");
}

// ─── Run ─────────────────────────────────────────────────────────────

if (FETCH_MODE) {
  fetchPhase().catch(e => { console.error("Error:", e); process.exit(1); });
} else {
  browsePhase().catch(e => { console.error("Error:", e); process.exit(1); });
}
