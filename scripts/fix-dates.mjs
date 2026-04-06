#!/usr/bin/env node

/**
 * Fix album dates for live/archival releases where the title contains a year
 * that's earlier than the listed release date.
 *
 * Examples:
 *   "Live in Stockholm 1960" listed as 1985 → corrected to 1960
 *   "At Newport 1958" listed as 2001 → corrected to 1958
 *
 * Also handles date-formatted titles like "1969-07-01 - Venue Name".
 *
 * Only corrects when the title year is EARLIER than the release year,
 * to avoid false positives on albums like "2001: A Space Odyssey".
 *
 * Usage:
 *   node scripts/fix-dates.mjs              # apply fixes
 *   node scripts/fix-dates.mjs --dry-run    # preview only
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "..", "data", "albums.json");
const DRY_RUN = process.argv.includes("--dry-run");

const albums = JSON.parse(readFileSync(DATA_FILE, "utf8"));

// Patterns that indicate the title year is a recording/performance date
const LIVE_INDICATORS = [
  /live/i, /concert/i, /montreux/i, /newport/i, /olympia/i,
  /festival/i, /broadcast/i, /session/i, /birdland/i, /vanguard/i,
  /tour/i, /in paris/i, /in tokyo/i, /in europe/i, /in stockholm/i,
  /in oslo/i, /in concert/i, /at the/i, /^\d{4}-\d{2}-\d{2}/,
];

let fixed = 0;

for (const album of albums) {
  if (!album.year || !album.title) continue;

  // Extract all 4-digit years from the title (1920-2029)
  const yearMatches = [...album.title.matchAll(/\b(19[2-9]\d|20[0-2]\d)\b/g)];
  if (yearMatches.length === 0) continue;

  // Use the earliest year found in the title
  const titleYear = Math.min(...yearMatches.map(m => parseInt(m[1])));

  // Only fix if title year is earlier than listed year by 3+ years
  if (album.year - titleYear < 3) continue;

  // Extra safety: for non-obvious cases, require a live/archival indicator
  const hasIndicator = LIVE_INDICATORS.some(re => re.test(album.title));

  // Date-formatted titles (e.g., "1964-04-17: Venue") are always live recordings
  const isDateTitle = /^\d{4}-\d{2}-\d{2}/.test(album.title);

  // Year ranges like "1946-1949" or "1952-1957" indicate compilations/archival
  const isYearRange = /\d{4}[-–]\d{4}/.test(album.title);

  // City + year pattern (e.g., "Paris 1958", "Chicago 1977", "Stockholm 1960")
  const isCityYear = /[A-Z][a-z]+\s+(19|20)\d{2}\b/.test(album.title);

  // Title is just a year or starts with a year (e.g., "1951", "1957 Second Edition")
  const isYearTitle = /^\d{4}\b/.test(album.title);

  // "Recorded in YEAR" pattern
  const isRecordedIn = /recorded\s+in\s+\d{4}/i.test(album.title);

  if (!hasIndicator && !isDateTitle && !isYearRange && !isCityYear && !isYearTitle && !isRecordedIn) continue;

  console.log(
    `${album.artist} — ${album.title}: ${album.year} → ${titleYear}`
  );
  if (!DRY_RUN) {
    album.year = titleYear;
  }
  fixed++;
}

if (!DRY_RUN) {
  writeFileSync(DATA_FILE, JSON.stringify(albums, null, 2) + "\n");
}

console.log(
  `\n${DRY_RUN ? "Would fix" : "Fixed"}: ${fixed} albums`
);
