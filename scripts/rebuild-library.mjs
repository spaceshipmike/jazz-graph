#!/usr/bin/env node

/**
 * Rebuild the Jazz Graph library from the curated artist roster.
 *
 * Reads data/artist-roster.json, fetches complete discographies from
 * MusicBrainz for each artist (and label catalogs), then fetches
 * lineup details for every album.
 *
 * Usage:
 *   node scripts/rebuild-library.mjs              # full rebuild
 *   node scripts/rebuild-library.mjs --resume     # resume interrupted run
 *   node scripts/rebuild-library.mjs --browse     # phase 1 only: list discographies
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ROSTER_FILE = join(ROOT, "data", "artist-roster.json");
const OUTPUT_FILE = join(ROOT, "data", "albums.json");
const PROGRESS_FILE = join(ROOT, "data", ".rebuild-progress.json");

const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "TheJazzGraph/0.1.0 (https://github.com/jazz-graph)";

const args = process.argv.slice(2);
const RESUME = args.includes("--resume");
const BROWSE_ONLY = args.includes("--browse");

// ─── Rate-limited MusicBrainz fetch ──────────────────────────────────

let lastReq = 0;
let apiCalls = 0;

async function mbFetch(url) {
  const wait = Math.max(0, 1100 - (Date.now() - lastReq));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastReq = Date.now();
  apiCalls++;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (res.status === 503 || res.status === 429) {
    await new Promise(r => setTimeout(r, 5000));
    return mbFetch(url);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

// ─── Junk label blacklist ─────────────────────────────────────────────

const JUNK_LABELS = new Set([
  "deja vu",
  "laserlight",
  "hallmark",
  "membran",
  "not now music",
  "waxtime",
  "jazz images",
  "poll winners",
  "essential jazz classics",
  "documents",
  "saga",
  "proper records",
  "jazz wax",
  "jazz wax records",
  "lr records",
  "stardust records",
  "giants of jazz",
  "master jazz",
  "pickwick",
  "sounds of yesteryear",
  "fabulous",
  "jasmine records",
  "acrobat",
  "avid",
  "phoenix",
  "magic",
  "ais",
  "golden stars",
  "american jazz classics",
  "broken silence",
]);

function isJunkLabel(label) {
  if (!label) return false;
  return JUNK_LABELS.has(label.toLowerCase().trim());
}

function slugify(str) {
  return str.toLowerCase().replace(/[''""]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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

async function fetchArtistDiscography(artistId) {
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

async function fetchLabelCatalog(labelName) {
  // Find label
  const query = encodeURIComponent(`label:"${labelName}"`);
  const res = await mbFetch(`${MB_BASE}/label/?query=${query}&fmt=json&limit=5`);
  const data = await res.json();
  if (!data.labels?.length) return [];

  const label = data.labels.find(l => l.name.toLowerCase() === labelName.toLowerCase()) || data.labels[0];
  console.log(`  Label: ${label.name} (MB ID: ${label.id})`);

  // Fetch releases by label
  const releases = [];
  let offset = 0;
  while (true) {
    const url = `${MB_BASE}/release/?label=${label.id}&fmt=json&limit=100&offset=${offset}&inc=release-groups+artist-credits`;
    const r = await mbFetch(url);
    const d = await r.json();
    const rels = d.releases || [];
    if (rels.length === 0) break;
    releases.push(...rels);
    offset += 100;
    if (offset >= (d["release-count"] || 0)) break;
  }

  // Deduplicate by release group
  const seen = new Set();
  const albums = [];
  for (const rel of releases) {
    const rgid = rel["release-group"]?.id;
    if (!rgid || seen.has(rgid)) continue;
    seen.add(rgid);
    const artist = rel["artist-credit"]?.[0]?.name || "Unknown";
    albums.push({
      rgid,
      title: rel.title,
      artist,
      year: rel.date?.slice(0, 4) || null,
      releaseId: rel.id,
    });
  }

  albums.sort((a, b) => (a.year || "9999").localeCompare(b.year || "9999"));
  return albums;
}

async function fetchAlbumDetails(rgid, artistName) {
  // Get release group with releases
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

  const label = details["label-info"]?.[0]?.label?.name || null;

  if (isJunkLabel(label)) return { skipped: "junk-label", label };

  // Extract track listings from recordings
  const tracks = [];
  if (details?.media) {
    for (const medium of details.media) {
      for (const track of medium.tracks || []) {
        tracks.push({
          title: track.title || track.recording?.title || "Untitled",
          position: track.position,
          lengthMs: track.length || track.recording?.length || null,
        });
      }
    }
  }

  return {
    id: slugify(`${creditedArtist}-${rg.title}`),
    title: rg.title,
    artist: creditedArtist,
    year,
    label,
    coverPath: null,
    mbid: release.id,
    rgid: rg.id,
    lineup,
    tracks,
  };
}

// ─── Progress management ─────────────────────────────────────────────

function loadProgress() {
  if (RESUME && existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, "utf8"));
  }
  return { phase: "browse", artistIdx: 0, labelIdx: 0, fetchIdx: 0, catalog: [], albums: [] };
}

function saveProgress(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress));
}

function cleanProgress() {
  if (existsSync(PROGRESS_FILE)) {
    const { unlinkSync } = require("fs");
    unlinkSync(PROGRESS_FILE);
  }
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  const roster = JSON.parse(readFileSync(ROSTER_FILE, "utf8"));
  const artistNames = roster.artists;
  const labelNames = roster.labels || [];

  const progress = loadProgress();
  const skipTypes = new Set(["Compilation", "Remix", "DJ-mix", "Mixtape/Street"]);

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  The Jazz Graph — Library Rebuild");
  console.log(`  ${artistNames.length} artists + ${labelNames.length} label catalogs`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  // ── Phase 1: Browse discographies ────────────────────────────────

  if (progress.phase === "browse") {
    console.log("Phase 1: Fetching discographies\n");

    for (let i = progress.artistIdx; i < artistNames.length; i++) {
      const name = artistNames[i];
      process.stdout.write(`[${i + 1}/${artistNames.length}] ${name}`);

      try {
        const artist = await findArtist(name);
        if (!artist) { console.log(" — not found"); continue; }

        const disco = await fetchArtistDiscography(artist.id);
        const studio = disco.filter(d => !d.secondaryTypes.some(t => skipTypes.has(t)));

        console.log(` — ${studio.length} studio albums`);

        for (const rg of studio) {
          progress.catalog.push({
            artist: artist.name,
            artistMbid: artist.id,
            title: rg.title,
            rgid: rg.rgid,
            year: rg.year,
            source: "artist",
          });
        }
      } catch (e) {
        console.log(` — error: ${e.message}`);
      }

      progress.artistIdx = i + 1;
      if (i % 5 === 4) saveProgress(progress);
    }

    // Label catalogs
    for (let i = progress.labelIdx; i < labelNames.length; i++) {
      const labelName = labelNames[i];
      console.log(`\nLabel: ${labelName}`);

      try {
        const catalog = await fetchLabelCatalog(labelName);
        console.log(`  ${catalog.length} releases`);

        for (const rel of catalog) {
          // Skip if already in catalog from artist phase
          const exists = progress.catalog.some(c => c.rgid === rel.rgid);
          if (!exists) {
            progress.catalog.push({
              artist: rel.artist,
              title: rel.title,
              rgid: rel.rgid,
              year: rel.year,
              source: `label:${labelName}`,
            });
          }
        }
      } catch (e) {
        console.log(`  error: ${e.message}`);
      }

      progress.labelIdx = i + 1;
    }

    // Deduplicate by rgid
    const seen = new Set();
    progress.catalog = progress.catalog.filter(c => {
      if (seen.has(c.rgid)) return false;
      seen.add(c.rgid);
      return true;
    });

    console.log(`\nPhase 1 complete: ${progress.catalog.length} unique albums to fetch`);
    const fetchTime = Math.ceil(progress.catalog.length * 2 * 1.1 / 60);
    console.log(`Phase 2 estimate: ~${fetchTime} min (${(fetchTime / 60).toFixed(1)} hrs)\n`);

    progress.phase = "fetch";
    saveProgress(progress);

    if (BROWSE_ONLY) {
      console.log("Browse-only mode. Run without --browse to continue to Phase 2.");
      return;
    }
  }

  // ── Phase 2: Fetch album details ─────────────────────────────────

  if (progress.phase === "fetch") {
    const catalog = progress.catalog;
    const albums = progress.albums || [];
    const existingIds = new Set(albums.map(a => a.id));

    console.log(`Phase 2: Fetching album details (${catalog.length - progress.fetchIdx} remaining)\n`);

    let added = 0, failed = 0, skipped = 0, junkLabels = 0;

    for (let i = progress.fetchIdx; i < catalog.length; i++) {
      const entry = catalog[i];
      const pct = ((i / catalog.length) * 100).toFixed(1);
      process.stdout.write(`[${i + 1}/${catalog.length} ${pct}%] ${entry.artist} — ${entry.title}`);

      try {
        const album = await fetchAlbumDetails(entry.rgid, entry.artist);
        if (!album) { console.log(" ✗ no release"); failed++; continue; }

        if (album.skipped === "junk-label") {
          console.log(` ✗ junk label: ${album.label}`);
          junkLabels++;
          continue;
        }

        if (existingIds.has(album.id)) {
          console.log(" · dup");
          skipped++;
        } else {
          albums.push(album);
          existingIds.add(album.id);
          added++;
          console.log(` ✓ ${album.lineup.length} musicians`);
        }
      } catch (e) {
        console.log(` ✗ ${e.message}`);
        failed++;
      }

      progress.fetchIdx = i + 1;
      progress.albums = albums;

      // Save every 25 albums
      if (i % 25 === 24) {
        saveProgress(progress);
        writeFileSync(OUTPUT_FILE, JSON.stringify(albums, null, 2));
      }
    }

    // Final save
    writeFileSync(OUTPUT_FILE, JSON.stringify(albums, null, 2));

    // Clean up progress
    try { require("fs").unlinkSync(PROGRESS_FILE); } catch {}

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  Rebuild Complete");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  Albums added:   ${added}`);
    console.log(`  Duplicates:     ${skipped}`);
    console.log(`  Junk labels:    ${junkLabels}`);
    console.log(`  Failed:         ${failed}`);
    console.log(`  Total:          ${albums.length}`);
    console.log(`  API calls:      ${apiCalls}`);
    console.log(`\n  Next steps:`);
    console.log(`    1. node scripts/fetch-spotify-covers.mjs   # Spotify covers (primary)`);
    console.log(`    2. node scripts/fetch-covers.mjs            # Cover Art Archive fallback`);
    console.log(`    3. node scripts/fetch-wikipedia-covers.mjs  # Wikipedia fallback`);
    console.log(`    4. node scripts/extract-colors.mjs          # dominant color extraction`);
    console.log(`    5. node scripts/optimize-images.mjs         # convert to WebP`);
  }
}

main().catch(e => { console.error("Error:", e); process.exit(1); });
