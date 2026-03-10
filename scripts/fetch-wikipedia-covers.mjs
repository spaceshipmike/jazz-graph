#!/usr/bin/env node

/**
 * Fetch cover art from Wikipedia/Wikimedia Commons for albums missing covers.
 * Uses the MediaWiki API to find album pages and extract cover images.
 *
 * Usage:
 *   node scripts/fetch-wikipedia-covers.mjs
 *   node scripts/fetch-wikipedia-covers.mjs --dry-run
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_FILE = join(ROOT, "data", "albums.json");
const COVERS_DIR = join(ROOT, "data", "images", "covers");
const DRY_RUN = process.argv.includes("--dry-run");

mkdirSync(COVERS_DIR, { recursive: true });

const UA = "TheJazzGraph/0.1.0 (https://jazz.h3r3.com; jazz-graph cover fetcher)";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Wikipedia Search ───────────────────────────────────────────────

/**
 * Normalize a title for fuzzy comparison: lowercase, strip punctuation,
 * collapse whitespace, remove common suffixes like "(album)".
 */
function normalize(s) {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[''"":.!?,\-–—/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if two normalized strings are a close enough match.
 * Requires one to contain the other, or high word overlap.
 */
function titlesMatch(pageTitle, albumTitle) {
  const a = normalize(pageTitle);
  const b = normalize(albumTitle);
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  // Word overlap: at least 70% of album title words must appear in page title
  const albumWords = b.split(" ").filter((w) => w.length > 2);
  if (albumWords.length === 0) return false;
  const hits = albumWords.filter((w) => a.includes(w)).length;
  return hits / albumWords.length >= 0.7;
}

/**
 * Search Wikipedia for an album page and return the main image URL.
 * Strict matching: the Wikipedia page title must closely match the album title.
 */
async function findCoverOnWikipedia(title, artist) {
  // Try direct page lookup first (fastest, most precise)
  const directUrl = await tryDirectPage(`${title} (album)`);
  if (directUrl) return directUrl;

  // Then search
  const queries = [
    `${title} ${artist} album`,
    `${title} (album)`,
  ];

  for (const query of queries) {
    const imageUrl = await trySearch(query, title, artist);
    if (imageUrl) return imageUrl;
    await sleep(200);
  }

  return null;
}

/**
 * Try to directly access a Wikipedia page by exact title.
 */
async function tryDirectPage(pageTitle) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    titles: pageTitle,
    prop: "pageimages",
    piprop: "original",
    pilicense: "any",
  });

  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) return null;

  const data = await res.json();
  const pages = data.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  // Page ID -1 means it doesn't exist
  if (!page || page.pageid === undefined || page.pageid < 0) return null;

  const imageUrl = page?.original?.source;
  if (!imageUrl || imageUrl.endsWith(".svg") || imageUrl.includes("logo")) return null;
  return imageUrl;
}

async function trySearch(query, title, artist) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    list: "search",
    srsearch: query,
    srnamespace: "0",
    srlimit: "5",
  });

  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) return null;

  const data = await res.json();
  const results = data.query?.search;
  if (!results || results.length === 0) return null;

  // Strict matching: page title must closely match the album title
  const match = results.find((r) => titlesMatch(r.title, title));

  if (!match) return null;

  // Verify the snippet mentions the artist to avoid false positives
  const snippet = (match.snippet || "").toLowerCase().replace(/<[^>]*>/g, "");
  const artistLower = artist.toLowerCase();
  const artistLast = artistLower.split(" ").pop();
  if (!snippet.includes(artistLast) && !match.title.toLowerCase().includes(artistLast)) return null;

  // Get the page image (usually the infobox image / cover art)
  return await getPageImage(match.title);
}

async function getPageImage(pageTitle) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    titles: pageTitle,
    prop: "pageimages",
    piprop: "original",
    pilicense: "any",
  });

  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) return null;

  const data = await res.json();
  const pages = data.query?.pages;
  if (!pages) return null;

  const page = Object.values(pages)[0];
  const imageUrl = page?.original?.source;

  if (!imageUrl) return null;

  // Skip SVG files, logos, and very small images
  if (imageUrl.endsWith(".svg") || imageUrl.includes("logo")) return null;

  return imageUrl;
}

// ─── Download ───────────────────────────────────────────────────────

async function downloadCover(url, slug) {
  const outPath = join(COVERS_DIR, `${slug}.jpg`);

  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    redirect: "follow",
  });
  if (!res.ok) return false;

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) return false;

  const buf = Buffer.from(await res.arrayBuffer());
  // Skip tiny images (likely placeholders)
  if (buf.byteLength < 5000) return false;

  writeFileSync(outPath, buf);
  return true;
}

// ─── Main ───────────────────────────────────────────────────────────

const albums = JSON.parse(readFileSync(DATA_FILE, "utf8"));
const missing = albums.filter((a) => !a.coverPath);

console.log("═══════════════════════════════════════════════════════════════");
console.log("  Fetching cover art from Wikipedia / Wikimedia Commons");
console.log(`  ${missing.length} albums missing covers`);
if (DRY_RUN) console.log("  (DRY RUN — no downloads)");
console.log("═══════════════════════════════════════════════════════════════");
console.log();

let found = 0;
let notFound = 0;

for (let i = 0; i < missing.length; i++) {
  const album = missing[i];
  const prefix = `[${i + 1}/${missing.length}]`;

  const imageUrl = await findCoverOnWikipedia(album.title, album.artist);

  if (!imageUrl) {
    notFound++;
    console.log(`${prefix} · ${album.artist} — ${album.title}`);
    await sleep(300);
    continue;
  }

  if (DRY_RUN) {
    found++;
    console.log(`${prefix} ★ ${album.artist} — ${album.title}`);
    console.log(`       ${imageUrl}`);
    await sleep(300);
    continue;
  }

  const downloaded = await downloadCover(imageUrl, album.id);

  if (downloaded) {
    album.coverPath = `images/covers/${album.id}.jpg`;
    found++;
    console.log(`${prefix} ★ ${album.artist} — ${album.title}`);
  } else {
    notFound++;
    console.log(`${prefix} · ${album.artist} — ${album.title} (download failed)`);
  }

  // Be polite to Wikipedia
  await sleep(500);

  // Save progress every 25 albums
  if (!DRY_RUN && i % 25 === 24) {
    writeFileSync(DATA_FILE, JSON.stringify(albums, null, 2) + "\n");
  }
}

if (!DRY_RUN) {
  writeFileSync(DATA_FILE, JSON.stringify(albums, null, 2) + "\n");
}

console.log();
console.log("═══════════════════════════════════════════════════════════════");
console.log(`  Found: ${found}  Not found: ${notFound}`);
console.log("═══════════════════════════════════════════════════════════════");
