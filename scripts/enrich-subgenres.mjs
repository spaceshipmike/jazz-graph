#!/usr/bin/env node

/**
 * Subgenre Enrichment Pipeline
 *
 * Multi-source enrichment: Discogs styles (primary) → MusicBrainz release-group
 * genres (secondary) → MusicBrainz artist genres (fallback).
 *
 * Usage:
 *   node scripts/enrich-subgenres.mjs              # full run (all sources)
 *   node scripts/enrich-subgenres.mjs --resume      # resume from progress
 *   node scripts/enrich-subgenres.mjs --dry-run     # preview without saving
 *   node scripts/enrich-subgenres.mjs --discogs     # Discogs only
 *   node scripts/enrich-subgenres.mjs --mb          # MusicBrainz only
 *   node scripts/enrich-subgenres.mjs --stats       # show current coverage stats
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_FILE = join(ROOT, "data", "albums.json");
const PROGRESS_FILE = join(ROOT, "data", ".subgenre-progress.json");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const RESUME = args.includes("--resume");
const DISCOGS_ONLY = args.includes("--discogs");
const MB_ONLY = args.includes("--mb");
const STATS_ONLY = args.includes("--stats");

const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;
const UA = "TheJazzGraph/0.1 +https://jazz.h3r3.com";
const MB_UA = "TheJazzGraph/0.1 ( jazz@h3r3.com )";

const DISCOGS_RATE_MS = DISCOGS_TOKEN ? 1100 : 3000;
const MB_RATE_MS = 1100;

// ── Normalization Map ──────────────────────────────────────────────

const NORMALIZE = {
  // Discogs styles → canonical
  "Hard Bop": "hard bop",
  "Post Bop": "post-bop",
  "Modal": "modal jazz",
  "Bop": "bebop",
  "Fusion": "jazz fusion",
  "Jazz-Funk": "jazz-funk",
  "Jazz-Rock": "jazz fusion",
  "Soul-Jazz": "soul jazz",
  "Avant-garde Jazz": "avant-garde jazz",
  "Cool Jazz": "cool jazz",
  "Free Jazz": "free jazz",
  "Free Improvisation": "free jazz",
  "Latin Jazz": "latin jazz",
  "Big Band": "big band",
  "Swing": "swing",
  "Spiritual Jazz": "spiritual jazz",
  "Bossa Nova": "bossa nova",
  "Contemporary Jazz": "post-bop",
  "Space-Age": "avant-garde jazz",
  "Smooth Jazz": null, // exclude
  "Dixieland": null,
  "Ragtime": null,

  // MusicBrainz genres → canonical (already lowercase)
  "hard bop": "hard bop",
  "post-bop": "post-bop",
  "modal jazz": "modal jazz",
  "bebop": "bebop",
  "jazz fusion": "jazz fusion",
  "jazz-funk": "jazz-funk",
  "jazz rock": "jazz fusion",
  "soul jazz": "soul jazz",
  "avant-garde jazz": "avant-garde jazz",
  "cool jazz": "cool jazz",
  "free jazz": "free jazz",
  "latin jazz": "latin jazz",
  "big band": "big band",
  "swing": "swing",
  "spiritual jazz": "spiritual jazz",
  "bossa nova": "bossa nova",
  "afro-cuban jazz": "latin jazz",
  "afro-jazz": "latin jazz",
  "modern creative": "avant-garde jazz",
  "ethio-jazz": "latin jazz",
};

const CANONICAL = new Set([
  "hard bop", "bebop", "cool jazz", "post-bop", "modal jazz",
  "free jazz", "soul jazz", "jazz fusion", "jazz-funk", "latin jazz",
  "avant-garde jazz", "big band", "spiritual jazz", "swing", "bossa nova",
]);

function normalizeStyles(raw) {
  const result = new Set();
  for (const s of raw) {
    const mapped = NORMALIZE[s];
    if (mapped && CANONICAL.has(mapped)) result.add(mapped);
  }
  return [...result].sort();
}

// ── Helpers ────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Discogs Search ─────────────────────────────────────────────────

let discogsLast = 0;

async function searchDiscogs(artist, title) {
  const wait = Math.max(0, DISCOGS_RATE_MS - (Date.now() - discogsLast));
  if (wait > 0) await sleep(wait);
  discogsLast = Date.now();

  const params = new URLSearchParams({
    q: `${artist} ${title}`,
    type: "master",
    per_page: "3",
  });
  if (DISCOGS_TOKEN) params.set("token", DISCOGS_TOKEN);

  const url = `https://api.discogs.com/database/search?${params}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });

  if (res.status === 429) {
    console.log("  ⏳ Discogs rate limited, waiting 60s...");
    await sleep(60000);
    return searchDiscogs(artist, title);
  }
  if (!res.ok) return null;

  const data = await res.json();
  const hit = data.results?.[0];
  if (!hit) return null;

  return {
    styles: hit.style || [],
    genre: hit.genre || [],
  };
}

// ── MusicBrainz Fetch ──────────────────────────────────────────────

let mbLast = 0;

async function mbFetch(url) {
  const wait = Math.max(0, MB_RATE_MS - (Date.now() - mbLast));
  if (wait > 0) await sleep(wait);
  mbLast = Date.now();

  const res = await fetch(url, { headers: { "User-Agent": MB_UA } });
  if (res.status === 503 || res.status === 429) {
    console.log("  ⏳ MB rate limited, waiting 5s...");
    await sleep(5000);
    return mbFetch(url);
  }
  if (!res.ok) return null;
  return res.json();
}

async function mbReleaseGroupGenres(rgid) {
  const data = await mbFetch(
    `https://musicbrainz.org/ws/2/release-group/${rgid}?inc=genres&fmt=json`
  );
  if (!data?.genres) return [];
  return data.genres
    .filter((g) => g.count >= 1)
    .map((g) => g.name);
}

async function mbArtistGenres(name) {
  const data = await mbFetch(
    `https://musicbrainz.org/ws/2/artist/?query=artist:${encodeURIComponent(name)}&fmt=json&limit=1`
  );
  const mbid = data?.artists?.[0]?.id;
  if (!mbid) return [];

  const detail = await mbFetch(
    `https://musicbrainz.org/ws/2/artist/${mbid}?inc=genres&fmt=json`
  );
  if (!detail?.genres) return [];
  return detail.genres
    .filter((g) => g.count >= 2)
    .map((g) => g.name);
}

// ── Progress ───────────────────────────────────────────────────────

function loadProgress() {
  if (RESUME && existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, "utf8"));
  }
  return { discogsDone: [], mbDone: [], artistCache: {} };
}

function saveProgress(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress));
}

// ── Merge-safe save ────────────────────────────────────────────────

function saveAlbums(updates) {
  const fresh = JSON.parse(readFileSync(DATA_FILE, "utf8"));
  const idIndex = new Map(fresh.map((a, i) => [a.id, i]));
  let merged = 0;

  for (const [id, data] of updates) {
    const idx = idIndex.get(id);
    if (idx !== undefined) {
      if (data.subgenres) fresh[idx].subgenres = data.subgenres;
      if (data.discogsStyles) fresh[idx].discogsStyles = data.discogsStyles;
      merged++;
    }
  }

  writeFileSync(DATA_FILE, JSON.stringify(fresh, null, 2) + "\n");
  console.log(`  Saved ${merged} albums`);
}

// ── Stats ──────────────────────────────────────────────────────────

function showStats(albums) {
  const withSubgenres = albums.filter((a) => a.subgenres?.length > 0);
  const counts = {};
  for (const a of albums) {
    for (const s of a.subgenres || []) {
      counts[s] = (counts[s] || 0) + 1;
    }
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Subgenre Coverage");
  console.log(`  ${withSubgenres.length}/${albums.length} albums (${((withSubgenres.length / albums.length) * 100).toFixed(1)}%)`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  for (const [name, count] of sorted) {
    const bar = "█".repeat(Math.round(count / 10));
    console.log(`  ${name.padEnd(20)} ${String(count).padStart(4)}  ${bar}`);
  }
  console.log();
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  const albums = JSON.parse(readFileSync(DATA_FILE, "utf8"));

  if (STATS_ONLY) {
    showStats(albums);
    return;
  }

  if (!DISCOGS_TOKEN && !MB_ONLY) {
    console.error("Set DISCOGS_TOKEN env var (or use --mb for MusicBrainz only)");
    process.exit(1);
  }

  const progress = loadProgress();
  const updates = new Map();
  const discogsDone = new Set(progress.discogsDone);
  const mbDone = new Set(progress.mbDone);
  const artistCache = progress.artistCache || {};

  // ── Phase 1: Discogs styles ──────────────────────────────────

  if (!MB_ONLY) {
    const toProcess = albums.filter((a) => !discogsDone.has(a.id));
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  Phase 1: Discogs Styles");
    console.log(`  ${toProcess.length} albums to process (${discogsDone.size} already done)`);
    console.log("═══════════════════════════════════════════════════════════════\n");

    let found = 0, notFound = 0, errors = 0;

    for (let i = 0; i < toProcess.length; i++) {
      const album = toProcess[i];
      const prefix = `[${i + 1}/${toProcess.length}]`;

      try {
        const result = await searchDiscogs(album.artist, album.title);
        discogsDone.add(album.id);

        if (!result || result.styles.length === 0) {
          notFound++;
          console.log(`${prefix} · ${album.artist} — ${album.title} (no styles)`);
        } else {
          const raw = result.styles;
          const normalized = normalizeStyles(raw);
          found++;
          console.log(`${prefix} ✓ ${album.artist} — ${album.title} → ${normalized.join(", ") || raw.join(", ")}`);

          if (!DRY_RUN) {
            const existing = album.subgenres || [];
            const merged = [...new Set([...existing, ...normalized])].sort();
            updates.set(album.id, {
              subgenres: merged,
              discogsStyles: raw,
            });
          }
        }
      } catch (e) {
        errors++;
        discogsDone.add(album.id);
        console.log(`${prefix} ✗ ${album.artist} — ${album.title}: ${e.message}`);
      }

      if (i % 25 === 24 && !DRY_RUN) {
        saveAlbums(updates);
        progress.discogsDone = [...discogsDone];
        saveProgress(progress);
        updates.clear();
      }
    }

    if (!DRY_RUN && updates.size > 0) {
      saveAlbums(updates);
      progress.discogsDone = [...discogsDone];
      saveProgress(progress);
      updates.clear();
    }

    console.log(`\n  Discogs: ${found} found, ${notFound} not found, ${errors} errors\n`);
  }

  // ── Phase 2: MusicBrainz release-group genres ────────────────

  if (!DISCOGS_ONLY) {
    const freshAlbums = JSON.parse(readFileSync(DATA_FILE, "utf8"));
    const toProcess = freshAlbums.filter((a) => a.rgid && !mbDone.has(a.id));

    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  Phase 2: MusicBrainz Release-Group Genres");
    console.log(`  ${toProcess.length} albums to process (${mbDone.size} already done)`);
    console.log("═══════════════════════════════════════════════════════════════\n");

    let found = 0, nothing = 0, errors = 0;

    for (let i = 0; i < toProcess.length; i++) {
      const album = toProcess[i];
      const prefix = `[${i + 1}/${toProcess.length}]`;

      try {
        const raw = await mbReleaseGroupGenres(album.rgid);
        mbDone.add(album.id);
        const normalized = normalizeStyles(raw);
        const newGenres = normalized.filter((g) => !(album.subgenres || []).includes(g));

        if (newGenres.length > 0) {
          found++;
          console.log(`${prefix} ✓ ${album.artist} — ${album.title} → +${newGenres.join(", ")}`);
          if (!DRY_RUN) {
            const merged = [...new Set([...(album.subgenres || []), ...normalized])].sort();
            updates.set(album.id, { subgenres: merged });
          }
        } else {
          nothing++;
          console.log(`${prefix} · ${album.artist} — ${album.title} (no new genres)`);
        }
      } catch (e) {
        errors++;
        mbDone.add(album.id);
        console.log(`${prefix} ✗ ${album.artist} — ${album.title}: ${e.message}`);
      }

      if (i % 25 === 24 && !DRY_RUN) {
        saveAlbums(updates);
        progress.mbDone = [...mbDone];
        saveProgress(progress);
        updates.clear();
      }
    }

    if (!DRY_RUN && updates.size > 0) {
      saveAlbums(updates);
      progress.mbDone = [...mbDone];
      saveProgress(progress);
      updates.clear();
    }

    console.log(`\n  MB release-group: ${found} added, ${nothing} no new, ${errors} errors\n`);

    // ── Phase 3: MusicBrainz artist genres (fallback) ──────────

    const freshAlbums2 = JSON.parse(readFileSync(DATA_FILE, "utf8"));
    const noSubgenre = freshAlbums2.filter((a) => !a.subgenres || a.subgenres.length === 0);

    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  Phase 3: MusicBrainz Artist Genres (fallback)");
    console.log(`  ${noSubgenre.length} albums without subgenres`);
    console.log("═══════════════════════════════════════════════════════════════\n");

    const uniqueArtists = [...new Set(noSubgenre.map((a) => a.artist))];
    let artistsFetched = 0;

    for (const artist of uniqueArtists) {
      if (artistCache[artist]) continue;
      try {
        const raw = await mbArtistGenres(artist);
        artistCache[artist] = normalizeStyles(raw);
        artistsFetched++;
        console.log(`  Artist: ${artist} → ${artistCache[artist].join(", ") || "(none)"}`);
      } catch (e) {
        artistCache[artist] = [];
        console.log(`  Artist: ${artist} ✗ ${e.message}`);
      }
    }

    let applied = 0;
    for (const album of noSubgenre) {
      const genres = artistCache[album.artist];
      if (genres && genres.length > 0) {
        applied++;
        if (!DRY_RUN) {
          updates.set(album.id, { subgenres: genres });
        }
      }
    }

    if (!DRY_RUN && updates.size > 0) {
      saveAlbums(updates);
      progress.artistCache = artistCache;
      saveProgress(progress);
    }

    console.log(`\n  Artist fallback: ${artistsFetched} artists fetched, ${applied} albums enriched\n`);
  }

  // ── Final stats ──────────────────────────────────────────────

  const final = JSON.parse(readFileSync(DATA_FILE, "utf8"));
  showStats(final);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
