#!/usr/bin/env node

/**
 * The Jazz Graph — Data Pipeline
 *
 * Fetches album data from MusicBrainz + cover art from Cover Art Archive / Discogs.
 * Outputs: data/albums.json + data/images/covers/ + data/images/artists/
 *
 * Usage:
 *   node scripts/fetch-data.mjs                # full run
 *   node scripts/fetch-data.mjs --skip-images  # metadata only (fast)
 *   node scripts/fetch-data.mjs --resume       # resume from last progress
 *
 * Requires: DISCOGS_TOKEN env var for Discogs image fetching (optional but recommended).
 * Set it in .env as op://Dev/Discogs/token or export directly.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const COVERS_DIR = join(DATA_DIR, "images", "covers");
const ARTISTS_DIR = join(DATA_DIR, "images", "artists");
const OUTPUT_FILE = join(DATA_DIR, "albums.json");
const PROGRESS_FILE = join(DATA_DIR, ".fetch-progress.json");

const SKIP_IMAGES = process.argv.includes("--skip-images");
const RESUME = process.argv.includes("--resume");

const MB_BASE = "https://musicbrainz.org/ws/2";
const CAA_BASE = "https://coverartarchive.org";
const DISCOGS_BASE = "https://api.discogs.com";
const USER_AGENT = "TheJazzGraph/0.1.0 (https://github.com/jazz-graph)";
const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN || "";

// Rate limiting — MusicBrainz allows 1 req/sec, Discogs 60/min
let lastMbRequest = 0;
let lastDiscogsRequest = 0;

async function rateLimitedFetch(url, opts = {}, type = "mb") {
  const now = Date.now();
  if (type === "mb") {
    const wait = Math.max(0, 1100 - (now - lastMbRequest));
    if (wait > 0) await sleep(wait);
    lastMbRequest = Date.now();
  } else if (type === "discogs") {
    const wait = Math.max(0, 1100 - (now - lastDiscogsRequest));
    if (wait > 0) await sleep(wait);
    lastDiscogsRequest = Date.now();
  }

  const headers = {
    "User-Agent": USER_AGENT,
    ...opts.headers,
  };
  if (type === "discogs" && DISCOGS_TOKEN) {
    headers["Authorization"] = `Discogs token=${DISCOGS_TOKEN}`;
  }

  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) {
    if (res.status === 503 || res.status === 429) {
      // Rate limited — back off and retry
      console.log(`  Rate limited (${res.status}), waiting 5s...`);
      await sleep(5000);
      return rateLimitedFetch(url, opts, type);
    }
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── MusicBrainz Search ───────────────────────────────────────────────

async function searchMbRelease(title, artist) {
  const query = encodeURIComponent(`release:"${title}" AND artist:"${artist}"`);
  const url = `${MB_BASE}/release/?query=${query}&fmt=json&limit=5`;

  try {
    const res = await rateLimitedFetch(url, {}, "mb");
    const data = await res.json();
    if (!data.releases || data.releases.length === 0) return null;

    // Prefer official releases with the closest title match
    const match = data.releases.find(
      (r) => r.title.toLowerCase() === title.toLowerCase()
    ) || data.releases[0];

    return match;
  } catch (e) {
    console.log(`  MB search failed for "${title}": ${e.message}`);
    return null;
  }
}

async function getMbReleaseGroup(rgId) {
  const url = `${MB_BASE}/release-group/${rgId}?inc=releases&fmt=json`;
  try {
    const res = await rateLimitedFetch(url, {}, "mb");
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function getMbReleaseDetails(releaseId) {
  const url = `${MB_BASE}/release/${releaseId}?inc=artist-credits+recordings+release-groups&fmt=json`;
  try {
    const res = await rateLimitedFetch(url, {}, "mb");
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function getMbRecordingArtists(releaseId) {
  const url = `${MB_BASE}/release/${releaseId}?inc=artist-credits+recordings+recording-level-rels+artist-rels&fmt=json`;
  try {
    const res = await rateLimitedFetch(url, {}, "mb");
    return await res.json();
  } catch (e) {
    return null;
  }
}

// ─── Cover Art ────────────────────────────────────────────────────────

async function fetchCoverArt(releaseId, mbid, slug) {
  if (SKIP_IMAGES) return null;

  const outPath = join(COVERS_DIR, `${slug}.jpg`);
  if (existsSync(outPath)) return `images/covers/${slug}.jpg`;

  // Try Cover Art Archive first (uses release-group MBID)
  try {
    const caaUrl = `${CAA_BASE}/release/${releaseId}/front-500`;
    const res = await fetch(caaUrl, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(outPath, buf);
      return `images/covers/${slug}.jpg`;
    }
  } catch {}

  // Try with release-group ID
  if (mbid) {
    try {
      const caaUrl = `${CAA_BASE}/release-group/${mbid}/front-500`;
      const res = await fetch(caaUrl, {
        headers: { "User-Agent": USER_AGENT },
        redirect: "follow",
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        writeFileSync(outPath, buf);
        return `images/covers/${slug}.jpg`;
      }
    } catch {}
  }

  return null;
}

// ─── Discogs Search (fallback for covers + artist images) ─────────────

async function searchDiscogs(title, artist) {
  if (!DISCOGS_TOKEN) return null;

  const query = encodeURIComponent(`${title} ${artist}`);
  const url = `${DISCOGS_BASE}/database/search?q=${query}&type=release&per_page=3`;

  try {
    const res = await rateLimitedFetch(url, {}, "discogs");
    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;
    return data.results[0];
  } catch (e) {
    return null;
  }
}

async function fetchDiscogsCover(discogsResult, slug) {
  if (SKIP_IMAGES || !discogsResult) return null;

  const outPath = join(COVERS_DIR, `${slug}.jpg`);
  if (existsSync(outPath)) return `images/covers/${slug}.jpg`;

  const imgUrl = discogsResult.cover_image || discogsResult.thumb;
  if (!imgUrl || imgUrl.includes("spacer.gif")) return null;

  try {
    const res = await fetch(imgUrl, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(outPath, buf);
      return `images/covers/${slug}.jpg`;
    }
  } catch {}
  return null;
}

async function fetchDiscogsArtistImage(artistName) {
  if (SKIP_IMAGES || !DISCOGS_TOKEN) return null;

  const slug = slugify(artistName);
  const outPath = join(ARTISTS_DIR, `${slug}.jpg`);
  if (existsSync(outPath)) return `images/artists/${slug}.jpg`;

  const query = encodeURIComponent(artistName);
  const url = `${DISCOGS_BASE}/database/search?q=${query}&type=artist&per_page=3`;

  try {
    const res = await rateLimitedFetch(url, {}, "discogs");
    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;

    const artist = data.results[0];
    const imgUrl = artist.cover_image || artist.thumb;
    if (!imgUrl || imgUrl.includes("spacer.gif")) return null;

    const imgRes = await fetch(imgUrl, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (imgRes.ok) {
      const buf = Buffer.from(await imgRes.arrayBuffer());
      writeFileSync(outPath, buf);
      return `images/artists/${slug}.jpg`;
    }
  } catch {}
  return null;
}

// ─── Main Pipeline ────────────────────────────────────────────────────

async function processAlbum(seed, index, total) {
  const slug = slugify(`${seed.artist}-${seed.title}`);
  console.log(`[${index + 1}/${total}] ${seed.artist} — ${seed.title}`);

  // Search MusicBrainz
  const mbRelease = await searchMbRelease(seed.title, seed.artist);
  if (!mbRelease) {
    console.log("  ✗ Not found on MusicBrainz");
    return null;
  }

  const releaseId = mbRelease.id;
  const rgId = mbRelease["release-group"]?.id;
  console.log(`  ✓ MB: ${mbRelease.title} (${mbRelease.date || "?"}) [${releaseId}]`);

  // Get detailed release info for personnel
  const details = await getMbRecordingArtists(releaseId);

  // Extract lineup from artist relations
  const lineup = [];
  const seenMusicians = new Set();

  // The credited artist is typically the leader
  const creditedArtist = mbRelease["artist-credit"]?.[0]?.name || seed.artist;

  if (details?.relations) {
    for (const rel of details.relations) {
      if (rel.type === "instrument" || rel.type === "vocal" || rel.type === "performer") {
        const name = rel.artist?.name;
        const instrument = rel.attributes?.[0] || rel.type;
        if (name && !seenMusicians.has(name)) {
          seenMusicians.add(name);
          lineup.push({
            name,
            instrument: normalizeInstrument(instrument),
            lead: name === creditedArtist,
          });
        }
      }
    }
  }

  // Also check media/tracks for artist credits
  if (details?.media) {
    for (const medium of details.media) {
      for (const track of medium.tracks || []) {
        const recording = track.recording;
        if (recording?.relations) {
          for (const rel of recording.relations) {
            if (
              rel.type === "instrument" ||
              rel.type === "vocal" ||
              rel.type === "performer"
            ) {
              const name = rel.artist?.name;
              const instrument = rel.attributes?.[0] || rel.type;
              if (name && !seenMusicians.has(name)) {
                seenMusicians.add(name);
                lineup.push({
                  name,
                  instrument: normalizeInstrument(instrument),
                  lead: name === creditedArtist,
                });
              }
            }
          }
        }
      }
    }
  }

  // If no lineup found from relations, add the credited artist at minimum
  if (lineup.length === 0) {
    lineup.push({ name: creditedArtist, instrument: "unknown", lead: true });
  }

  // Ensure the credited artist is marked as lead
  const hasLead = lineup.some((m) => m.lead);
  if (!hasLead) {
    const leader = lineup.find((m) => m.name === creditedArtist);
    if (leader) leader.lead = true;
    else lineup.unshift({ name: creditedArtist, instrument: "leader", lead: true });
  }

  // Fetch cover art
  let coverPath = await fetchCoverArt(releaseId, rgId, slug);

  // Fallback to Discogs for cover
  if (!coverPath && DISCOGS_TOKEN) {
    const discogsResult = await searchDiscogs(seed.title, seed.artist);
    coverPath = await fetchDiscogsCover(discogsResult, slug);
  }

  if (coverPath) console.log("  ✓ Cover art downloaded");
  else if (!SKIP_IMAGES) console.log("  ✗ No cover art found");

  // Extract year — prefer release group first-release-date (original release)
  let year = null;
  if (rgId) {
    try {
      const rgData = await getMbReleaseGroup(rgId);
      const firstDate = rgData?.["first-release-date"];
      if (firstDate) year = parseInt(firstDate.slice(0, 4), 10);
    } catch {}
  }
  if (!year && mbRelease.date) {
    year = parseInt(mbRelease.date.slice(0, 4), 10);
  }

  // Extract label
  const label = mbRelease["label-info"]?.[0]?.label?.name || seed.label || null;

  return {
    id: slug,
    title: mbRelease.title || seed.title,
    artist: creditedArtist,
    year,
    label,
    coverPath,
    mbid: releaseId,
    rgid: rgId,
    lineup,
  };
}

function normalizeInstrument(inst) {
  if (!inst) return "unknown";
  const i = inst.toLowerCase().trim();

  const map = {
    "tenor saxophone": "tenor sax",
    "alto saxophone": "alto sax",
    "soprano saxophone": "soprano sax",
    "baritone saxophone": "baritone sax",
    "double bass": "bass",
    "contrabass": "bass",
    "acoustic bass": "bass",
    "electric bass guitar": "electric bass",
    "bass guitar": "electric bass",
    "drum set": "drums",
    "drumset": "drums",
    "drum kit": "drums",
    "electric guitar": "guitar",
    "acoustic guitar": "guitar",
    "electric piano": "electric piano",
    "rhodes": "electric piano",
    "fender rhodes": "electric piano",
    "synthesizer": "keyboards",
    "organ": "organ",
    "hammond organ": "organ",
    "vibes": "vibraphone",
    "congas": "percussion",
    "bongos": "percussion",
    "timbales": "percussion",
    "flugelhorn": "flugelhorn",
    "french horn": "french horn",
    "lead vocals": "vocals",
    "vocal": "vocals",
    "background vocals": "vocals",
  };

  return map[i] || i;
}

// ─── Run ──────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  The Jazz Graph — Data Pipeline");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();

  // Ensure directories exist
  mkdirSync(COVERS_DIR, { recursive: true });
  mkdirSync(ARTISTS_DIR, { recursive: true });

  // Load seed list
  const seeds = JSON.parse(readFileSync(join(__dirname, "seed-albums.json"), "utf8"));

  // Deduplicate seeds by title+artist
  const seen = new Set();
  const uniqueSeeds = seeds.filter((s) => {
    const key = `${s.title.toLowerCase()}|${s.artist.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`Seed list: ${uniqueSeeds.length} unique albums`);
  console.log(`Images: ${SKIP_IMAGES ? "SKIPPED" : "enabled"}`);
  console.log(`Discogs: ${DISCOGS_TOKEN ? "authenticated" : "no token (cover fallback disabled)"}`);
  console.log();

  // Load progress if resuming
  let albums = [];
  let startIndex = 0;

  if (RESUME && existsSync(PROGRESS_FILE)) {
    const progress = JSON.parse(readFileSync(PROGRESS_FILE, "utf8"));
    albums = progress.albums || [];
    startIndex = progress.lastIndex + 1;
    console.log(`Resuming from album ${startIndex + 1} (${albums.length} already fetched)`);
    console.log();
  }

  // Process albums
  const stats = { found: albums.length, covers: albums.filter((a) => a.coverPath).length, noPersonnel: 0, failed: 0 };

  for (let i = startIndex; i < uniqueSeeds.length; i++) {
    try {
      const album = await processAlbum(uniqueSeeds[i], i, uniqueSeeds.length);
      if (album) {
        albums.push(album);
        stats.found++;
        if (album.coverPath) stats.covers++;
        if (album.lineup.length <= 1) stats.noPersonnel++;
      } else {
        stats.failed++;
      }
    } catch (e) {
      console.log(`  ✗ Error: ${e.message}`);
      stats.failed++;
    }

    // Save progress every 10 albums
    if (i % 10 === 9) {
      writeFileSync(PROGRESS_FILE, JSON.stringify({ lastIndex: i, albums }, null, 2));
    }
  }

  // Collect unique artists and fetch photos
  if (!SKIP_IMAGES && DISCOGS_TOKEN) {
    const uniqueArtists = [...new Set(albums.flatMap((a) => a.lineup.filter((m) => m.lead).map((m) => m.name)))];
    console.log();
    console.log(`Fetching artist photos for ${uniqueArtists.length} lead artists...`);
    const artistPhotos = {};
    for (let i = 0; i < uniqueArtists.length; i++) {
      const name = uniqueArtists[i];
      console.log(`  [${i + 1}/${uniqueArtists.length}] ${name}`);
      const path = await fetchDiscogsArtistImage(name);
      if (path) {
        artistPhotos[name] = path;
        console.log("    ✓ Photo found");
      }
    }

    // Attach photo paths to albums for later use
    writeFileSync(join(DATA_DIR, "artist-photos.json"), JSON.stringify(artistPhotos, null, 2));
  }

  // Write final output
  writeFileSync(OUTPUT_FILE, JSON.stringify(albums, null, 2));

  // Clean up progress file
  if (existsSync(PROGRESS_FILE)) {
    const { unlinkSync } = await import("fs");
    unlinkSync(PROGRESS_FILE);
  }

  // Report
  console.log();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Pipeline Complete");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Albums found:      ${stats.found} / ${uniqueSeeds.length}`);
  console.log(`  Cover art:         ${stats.covers} / ${stats.found}`);
  console.log(`  Missing personnel: ${stats.noPersonnel}`);
  console.log(`  Failed:            ${stats.failed}`);
  console.log(`  Output:            ${OUTPUT_FILE}`);
  console.log();
}

main().catch((e) => {
  console.error("Pipeline failed:", e);
  process.exit(1);
});
