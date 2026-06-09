#!/usr/bin/env node

/**
 * Fetch artist portrait photos from Spotify for every musician in the library.
 *
 * Writes:
 *   data/images/artists/<slug>.webp        — 320px square WebP portraits
 *   data/artist-photos.json                — { "Artist Name": "images/artists/<slug>.webp" }
 *   data/.artist-photos-progress.json      — attempted names (incl. misses) for resume
 *
 * Usage:
 *   op run --env-file .env -- node scripts/fetch-artist-photos.mjs           # full run (resumable)
 *   op run --env-file .env -- node scripts/fetch-artist-photos.mjs --limit 50 # test a slice
 *   op run --env-file .env -- node scripts/fetch-artist-photos.mjs --fresh    # ignore progress, redo all
 *
 * Only exact (diacritic/case-insensitive) name matches with a portrait are kept,
 * so we don't grab the wrong same-named artist. Misses fall back to initials in the UI.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const ARTISTS_DIR = join(DATA_DIR, "images", "artists");
const PHOTOS_FILE = join(DATA_DIR, "artist-photos.json");
const PROGRESS_FILE = join(DATA_DIR, ".artist-photos-progress.json");

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const argv = process.argv.slice(2);
const FRESH = argv.includes("--fresh");
const LIMIT = argv.includes("--limit") ? parseInt(argv[argv.indexOf("--limit") + 1], 10) : Infinity;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET.");
  console.error("Run via: op run --env-file .env -- node scripts/fetch-artist-photos.mjs");
  process.exit(1);
}

mkdirSync(ARTISTS_DIR, { recursive: true });

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Normalize for name comparison: strip diacritics, punctuation, collapse spaces.
function norm(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ── Spotify auth (client credentials) ──────────────────────────

let token = null;
async function getAccessToken() {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function spotify(url) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 429) {
      const retry = parseInt(res.headers.get("retry-after") || "2", 10);
      await sleep((retry + 1) * 1000);
      continue;
    }
    if (res.status === 401) {
      token = await getAccessToken();
      continue;
    }
    if (!res.ok) throw new Error(`Spotify ${res.status} for ${url}`);
    return res.json();
  }
  throw new Error(`Spotify retries exhausted for ${url}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Find an exact-name artist with a portrait. Returns best image URL or null.
async function findArtistImage(name) {
  const q = encodeURIComponent(name);
  const data = await spotify(`https://api.spotify.com/v1/search?q=${q}&type=artist&limit=5`);
  const items = data.artists?.items || [];
  const target = norm(name);
  // Exact normalized match with at least one image; prefer most popular.
  const matches = items
    .filter((a) => norm(a.name) === target && a.images && a.images.length > 0)
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  if (!matches.length) return null;
  return matches[0].images[0].url; // images[0] is the largest
}

async function downloadPortrait(url, slug) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const rel = join("images", "artists", `${slug}.webp`);
  const dest = join(DATA_DIR, rel);
  await sharp(buf)
    .resize(320, 320, { fit: "cover", position: "attention" })
    .webp({ quality: 80, effort: 4 })
    .toFile(dest);
  return `images/artists/${slug}.webp`;
}

// ── Main ────────────────────────────────────────────────────────

const albums = JSON.parse(readFileSync(join(DATA_DIR, "albums.json"), "utf8"));

// Unique musicians, ranked by appearance count (prominent first).
const counts = new Map();
for (const al of albums) {
  for (const m of al.lineup || []) counts.set(m.name, (counts.get(m.name) || 0) + 1);
}
const musicians = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);

const photos = !FRESH && existsSync(PHOTOS_FILE) ? JSON.parse(readFileSync(PHOTOS_FILE, "utf8")) : {};
const attempted = new Set(!FRESH && existsSync(PROGRESS_FILE) ? JSON.parse(readFileSync(PROGRESS_FILE, "utf8")) : []);

const queue = musicians.filter((n) => !attempted.has(n)).slice(0, LIMIT);
console.log(`${musicians.length} unique musicians · ${attempted.size} already attempted · ${queue.length} to fetch`);

token = await getAccessToken();

let hits = 0, misses = 0, errors = 0, done = 0;

function save() {
  writeFileSync(PHOTOS_FILE, JSON.stringify(photos, null, 0));
  writeFileSync(PROGRESS_FILE, JSON.stringify([...attempted]));
}

for (const name of queue) {
  try {
    const slug = slugify(name);
    const rel = `images/artists/${slug}.webp`;
    if (existsSync(join(DATA_DIR, rel))) {
      photos[name] = rel;
      attempted.add(name);
      hits++;
    } else {
      const url = await findArtistImage(name);
      if (url) {
        photos[name] = await downloadPortrait(url, slug);
        hits++;
      } else {
        misses++;
      }
      attempted.add(name);
      await sleep(120); // gentle pacing
    }
  } catch (err) {
    errors++;
    console.warn(`  ! ${name}: ${err.message}`);
    // Don't mark attempted on hard error — let a re-run retry it.
  }

  done++;
  if (done % 25 === 0) {
    save();
    console.log(`  ${done}/${queue.length} · ${hits} photos · ${misses} no-match · ${errors} errors`);
  }
}

save();
console.log(`\nDone. ${hits} photos, ${misses} no-match, ${errors} errors.`);
console.log(`Total portraits in map: ${Object.keys(photos).length}`);
