#!/usr/bin/env node

/**
 * Data Quality Audit for The Jazz Graph
 *
 * Scans the finished albums.json for reissues, compilations, metadata gaps,
 * and other quality issues. Produces a report for human review.
 *
 * Usage:
 *   node scripts/audit-library.mjs                  # Scan, produce audit-report.json
 *   node scripts/audit-library.mjs --review         # Interactive review of report
 *   node scripts/audit-library.mjs --apply          # Apply approved actions (quarantine)
 *   node scripts/audit-library.mjs --backfill-types # Fetch MB secondary types for all albums
 *   node scripts/audit-library.mjs --decade 2000    # Scan only a specific decade
 *   node scripts/audit-library.mjs --stats          # Summary stats only
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ALBUMS_FILE = join(ROOT, "data", "albums.json");
const REPORT_FILE = join(ROOT, "data", "audit-report.json");
const QUARANTINE_FILE = join(ROOT, "data", "quarantine.json");
const PROGRESS_FILE = join(ROOT, "data", ".audit-backfill-progress.json");

const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "TheJazzGraph/0.1.0 (https://github.com/jazz-graph)";

const args = process.argv.slice(2);
const MODE_REVIEW = args.includes("--review");
const MODE_APPLY = args.includes("--apply");
const MODE_BACKFILL = args.includes("--backfill-types");
const MODE_STATS = args.includes("--stats");
const decadeIdx = args.indexOf("--decade");
const DECADE_FILTER = decadeIdx >= 0 ? parseInt(args[decadeIdx + 1], 10) : null;

// ─── Rate-limited MusicBrainz fetch ──────────────────────────────────

let lastReq = 0;
let apiCalls = 0;

async function mbFetch(url) {
  const wait = Math.max(0, 1100 - (Date.now() - lastReq));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastReq = Date.now();
  apiCalls++;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (res.status === 503 || res.status === 429) {
    console.log("  Rate limited, waiting 5s...");
    await new Promise((r) => setTimeout(r, 5000));
    return mbFetch(url);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

// ─── Reissue title patterns ──────────────────────────────────────────

const REISSUE_PATTERNS = [
  /\bcomplete\s+(session|recording|original)/i,
  /\bremaster(ed)?\b/i,
  /\bbest\s+of\b(?!\s+(lerner|rodgers|cole|gershwin|johnny|harold|jerome|irving))/i,
  /\bgreatest\s+hits\b/i,
  /\bhit\s+collection\b/i,
  /\bjazz\s+masters\b/i,
  /\bgold\s+collection\b/i,
  /\boriginal\s+jazz\s+classics\b/i,
  /\brising\s+sun\s+collection\b/i,
  /\bjazz\s+round\s+midnight\b/i,
  /\bgrandi\s+del\s+jazz\b/i,
  /\briverside\s+profiles\b/i,
  /\bthe\s+hits\b$/i,
  /\bsignature\b$/i,
  /\bcool\s+and\s+iconic\b/i,
  /\bfinest\b$/i,
  /\bsings\s+sessions\b$/i,
  /\bsesjun\s+radio\b/i,
  /\bvol\.\s*\d+\s*\(remastered\)/i,
  /\(remastered\s+\d{4}\)/i,
  /\bcollected\s+works\b/i,
  /\banthology\b/i,
  /\bdefinitive\b/i,
  /\bessential\b/i,
  /\bultimate\s+collection\b/i,
  /\bgreat(est)?\s+jazz\b/i,
  /\blegendary\b/i,
  /\bthe\s+complete\s+.*\bon\b/i,
  /\b\d+\s+years\s+of\b/i,
  /\bthe\s+best\b$/i,
  /\bgolden\s+(age|era|hits)\b/i,
];

// ─── Junk label blacklist ────────────────────────────────────────────

const JUNK_LABELS = new Set([
  "deja vu", "laserlight", "hallmark", "membran", "not now music",
  "waxtime", "jazz images", "poll winners", "essential jazz classics",
  "documents", "saga", "proper records", "jazz wax", "jazz wax records",
  "lr records", "stardust records", "giants of jazz", "master jazz",
  "pickwick", "sounds of yesteryear", "fabulous", "jasmine records",
  "acrobat", "avid", "phoenix", "magic", "ais", "golden stars",
  "american jazz classics", "broken silence", "past perfect",
  "past perfect silver line", "primo", "membran", "galaxy",
  "le jazz", "le chant du monde", "solar records", "charly",
  "jazz heritage", "collectables", "bbc music", "label m",
  "grammy", "the intense media", "intense media",
]);

// ─── Label-era definitions ───────────────────────────────────────────
// Maps label names to their primary active recording periods.
// Albums on these labels outside the window get medium-confidence flags.

const LABEL_ERAS = {
  "Prestige":       { start: 1949, end: 1975 },
  "Riverside":      { start: 1953, end: 1964 },
  "Blue Note":      { start: 1939, end: 2026 }, // active since 1939, revival in 1985 — too broad to flag
  "Impulse!":       { start: 1961, end: 1976 },
  "Atlantic":       { start: 1947, end: 2000 }, // active jazz label through the 90s
  "Columbia":       { start: 1938, end: 2000 }, // major label, long active
  "Verve":          { start: 1956, end: 2026 }, // revived in 1980s, still active
  "EmArcy":         { start: 1954, end: 1965 },
  "Mercury":        { start: 1945, end: 1975 },
  "Pacific Jazz":   { start: 1952, end: 1965 },
  "Contemporary":   { start: 1951, end: 1970 },
  "Debut":          { start: 1951, end: 1957 },
  "Bethlehem":      { start: 1953, end: 1962 },
  "Savoy":          { start: 1942, end: 1975 },
  "Dial":           { start: 1946, end: 1954 },
  "Clef":           { start: 1946, end: 1956 },
  "Norgran":        { start: 1953, end: 1956 },
  "Vogue":          { start: 1948, end: 1970 },
  "Capitol":        { start: 1942, end: 1980 },
  "RCA Victor":     { start: 1940, end: 1980 },
  "United Artists":  { start: 1958, end: 1979 },
  "Candid":         { start: 1960, end: 1962 },
};

// ─── Artist lifespan cache ───────────────────────────────────────────

const lifespanCache = new Map();

async function fetchArtistLifespan(name) {
  if (lifespanCache.has(name)) return lifespanCache.get(name);

  const query = encodeURIComponent(`artist:"${name}"`);
  const res = await mbFetch(`${MB_BASE}/artist/?query=${query}&fmt=json&limit=3`);
  const data = await res.json();
  const artist = data.artists?.find(
    (a) => a.name.toLowerCase() === name.toLowerCase()
  ) || data.artists?.[0];

  if (!artist) {
    lifespanCache.set(name, null);
    return null;
  }

  const begin = artist["life-span"]?.begin?.slice(0, 4);
  const end = artist["life-span"]?.end?.slice(0, 4);
  const result = {
    name: artist.name,
    mbid: artist.id,
    born: begin ? parseInt(begin, 10) : null,
    died: end ? parseInt(end, 10) : null,
    isGroup: artist.type === "Group",
  };
  lifespanCache.set(name, result);
  return result;
}

// ─── Audit checks ────────────────────────────────────────────────────

function checkSecondaryTypes(album) {
  const dominated = ["Compilation", "Live", "Remix", "DJ-mix", "Mixtape/Street"];
  const types = album.secondaryTypes || [];
  const hits = types.filter((t) => dominated.includes(t));
  if (hits.length > 0) {
    return {
      type: "mb-secondary-type",
      action: "REMOVE",
      confidence: "high",
      reason: `MB type: ${hits.join(", ")}`,
    };
  }
  return null;
}

function checkReissueTitle(album) {
  const match = REISSUE_PATTERNS.find((re) => re.test(album.title));
  if (match) {
    return {
      type: "reissue-title",
      action: "REMOVE",
      confidence: "high",
      reason: `Title matches reissue pattern: ${match.source.slice(0, 40)}`,
    };
  }
  return null;
}

function checkJunkLabel(album) {
  if (!album.label) return null;
  if (JUNK_LABELS.has(album.label.toLowerCase().trim())) {
    return {
      type: "junk-label",
      action: "REMOVE",
      confidence: "high",
      reason: `Budget/reissue label: ${album.label}`,
    };
  }
  return null;
}

function checkLabelEra(album) {
  if (!album.label || !album.year) return null;
  const era = LABEL_ERAS[album.label];
  if (!era) return null;
  if (album.year > era.end + 5) {
    return {
      type: "label-era-mismatch",
      action: "REMOVE",
      confidence: "medium",
      reason: `${album.label} active ${era.start}–${era.end}, album dated ${album.year}`,
    };
  }
  return null;
}

function checkThinLineup(album) {
  if (album.lineup.length <= 1) {
    return {
      type: "thin-lineup",
      action: "FLAG",
      confidence: "low",
      reason: `Only ${album.lineup.length} musician(s) in lineup`,
    };
  }
  return null;
}

function checkMissingTracks(album) {
  if (!album.tracks || album.tracks.length === 0) {
    return {
      type: "missing-tracks",
      action: "FLAG",
      confidence: "low",
      reason: "No track data",
    };
  }
  return null;
}

async function checkPosthumous(album) {
  if (!album.year) return null;
  const leader = album.lineup.find((m) => m.lead);
  if (!leader) return null;

  const life = await fetchArtistLifespan(leader.name);
  if (!life || !life.died) return null;

  const cutoff = life.died + 10;
  if (album.year > cutoff) {
    return {
      type: "posthumous",
      action: "REMOVE",
      confidence: "high",
      reason: `${leader.name} died ${life.died}, album dated ${album.year} (cutoff ${cutoff})`,
    };
  }
  return null;
}

function checkSuspectDate(album) {
  if (!album.year) return null;
  // Albums dated before jazz existed or in the far future
  if (album.year < 1917 || album.year > new Date().getFullYear()) {
    return {
      type: "suspect-date",
      action: "FLAG",
      confidence: "medium",
      reason: `Unlikely year: ${album.year}`,
    };
  }
  return null;
}

// ─── Scan mode ───────────────────────────────────────────────────────

async function scanLibrary() {
  const albums = JSON.parse(readFileSync(ALBUMS_FILE, "utf8"));

  let scope = albums;
  if (DECADE_FILTER) {
    scope = albums.filter(
      (a) => a.year >= DECADE_FILTER && a.year < DECADE_FILTER + 10
    );
    console.log(`Filtering to ${DECADE_FILTER}s: ${scope.length} albums\n`);
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Data Quality Audit");
  console.log(`  Scanning ${scope.length} of ${albums.length} albums`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  const report = [];
  const needsLifespan = new Set();

  // First pass: local checks (no API)
  for (const album of scope) {
    const issues = [];

    const secondary = checkSecondaryTypes(album);
    if (secondary) issues.push(secondary);

    const reissue = checkReissueTitle(album);
    if (reissue) issues.push(reissue);

    const junk = checkJunkLabel(album);
    if (junk) issues.push(junk);

    const labelEra = checkLabelEra(album);
    if (labelEra) issues.push(labelEra);

    const thinLineup = checkThinLineup(album);
    if (thinLineup) issues.push(thinLineup);

    const missingTracks = checkMissingTracks(album);
    if (missingTracks) issues.push(missingTracks);

    const suspectDate = checkSuspectDate(album);
    if (suspectDate) issues.push(suspectDate);

    if (issues.length > 0) {
      // Pick highest-confidence actionable issue as primary
      const priority = ["high", "medium", "low"];
      const actionable = ["REMOVE", "FIX_DATE", "FLAG"];
      issues.sort((a, b) => {
        const ap = priority.indexOf(a.confidence);
        const bp = priority.indexOf(b.confidence);
        if (ap !== bp) return ap - bp;
        return actionable.indexOf(a.action) - actionable.indexOf(b.action);
      });

      report.push({
        id: album.id,
        title: album.title,
        artist: album.artist,
        year: album.year,
        label: album.label || null,
        action: issues[0].action,
        confidence: issues[0].confidence,
        issues: issues.map((i) => ({
          type: i.type,
          action: i.action,
          confidence: i.confidence,
          reason: i.reason,
        })),
        reviewed: false,
        approved: null,
      });
    }

    // Track leaders for posthumous check
    const leader = album.lineup.find((m) => m.lead);
    if (leader && album.year) needsLifespan.add(leader.name);
  }

  // Second pass: posthumous check (requires API)
  const leadersToCheck = [...needsLifespan];
  if (leadersToCheck.length > 0) {
    console.log(`Fetching lifespans for ${leadersToCheck.length} lead artists...\n`);
    let checked = 0;
    for (const name of leadersToCheck) {
      checked++;
      if (checked % 20 === 0) {
        process.stdout.write(`  ${checked}/${leadersToCheck.length}\r`);
      }
      try {
        await fetchArtistLifespan(name);
      } catch {
        // skip on error
      }
    }
    console.log(`  Fetched ${lifespanCache.size} lifespans\n`);

    // Now check posthumous for albums not already flagged as REMOVE/high
    for (const album of scope) {
      const existing = report.find((r) => r.id === album.id);
      if (existing && existing.confidence === "high" && existing.action === "REMOVE") continue;

      const posthumous = await checkPosthumous(album);
      if (posthumous) {
        if (existing) {
          existing.issues.unshift({
            type: posthumous.type,
            action: posthumous.action,
            confidence: posthumous.confidence,
            reason: posthumous.reason,
          });
          existing.action = "REMOVE";
          existing.confidence = "high";
        } else {
          report.push({
            id: album.id,
            title: album.title,
            artist: album.artist,
            year: album.year,
            label: album.label || null,
            action: "REMOVE",
            confidence: "high",
            issues: [
              {
                type: posthumous.type,
                action: posthumous.action,
                confidence: posthumous.confidence,
                reason: posthumous.reason,
              },
            ],
            reviewed: false,
            approved: null,
          });
        }
      }
    }
  }

  // Sort: high confidence first, then by artist
  report.sort((a, b) => {
    const cp = ["high", "medium", "low"];
    const diff = cp.indexOf(a.confidence) - cp.indexOf(b.confidence);
    if (diff !== 0) return diff;
    return a.artist.localeCompare(b.artist) || (a.year || 0) - (b.year || 0);
  });

  writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  // Print summary
  printReport(report);

  console.log(`\nReport written to ${REPORT_FILE}`);
  console.log(`Next: node scripts/audit-library.mjs --review`);
}

function printReport(report) {
  const byConfidence = { high: 0, medium: 0, low: 0 };
  const byAction = {};
  const byType = {};
  const byDecade = {};

  for (const entry of report) {
    byConfidence[entry.confidence] = (byConfidence[entry.confidence] || 0) + 1;
    byAction[entry.action] = (byAction[entry.action] || 0) + 1;
    for (const issue of entry.issues) {
      byType[issue.type] = (byType[issue.type] || 0) + 1;
    }
    const dec = entry.year ? Math.floor(entry.year / 10) * 10 + "s" : "unknown";
    byDecade[dec] = (byDecade[dec] || 0) + 1;
  }

  console.log("─── Summary ────────────────────────────────────────────────");
  console.log(`  Total flagged:    ${report.length}`);
  console.log(`  By confidence:    high=${byConfidence.high || 0}  medium=${byConfidence.medium || 0}  low=${byConfidence.low || 0}`);
  console.log(`  By action:        ${Object.entries(byAction).map(([k, v]) => `${k}=${v}`).join("  ")}`);
  console.log();
  console.log("  By issue type:");
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type}: ${count}`);
  }
  console.log();
  console.log("  By decade:");
  for (const [dec, count] of Object.entries(byDecade).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`    ${dec}: ${count}`);
  }

  // Show some high-confidence examples
  const highConf = report.filter((r) => r.confidence === "high" && r.action === "REMOVE");
  if (highConf.length > 0) {
    console.log(`\n─── High-confidence removals (${highConf.length}) ─────────────────────`);
    for (const entry of highConf.slice(0, 25)) {
      const reasons = entry.issues.map((i) => i.reason).join("; ");
      console.log(`  ${entry.year || "????"} ${entry.artist} — ${entry.title}`);
      console.log(`         ${reasons}`);
    }
    if (highConf.length > 25) console.log(`  ... and ${highConf.length - 25} more`);
  }

  const medConf = report.filter((r) => r.confidence === "medium");
  if (medConf.length > 0) {
    console.log(`\n─── Medium-confidence flags (${medConf.length}) ──────────────────────`);
    for (const entry of medConf.slice(0, 15)) {
      const reasons = entry.issues.map((i) => i.reason).join("; ");
      console.log(`  ${entry.year || "????"} ${entry.artist} — ${entry.title}`);
      console.log(`         ${reasons}`);
    }
    if (medConf.length > 15) console.log(`  ... and ${medConf.length - 15} more`);
  }
}

// ─── Stats mode ──────────────────────────────────────────────────────

function showStats() {
  if (!existsSync(REPORT_FILE)) {
    console.log("No audit report found. Run: node scripts/audit-library.mjs");
    process.exit(1);
  }
  const report = JSON.parse(readFileSync(REPORT_FILE, "utf8"));
  printReport(report);
}

// ─── Review mode ─────────────────────────────────────────────────────

async function reviewReport() {
  if (!existsSync(REPORT_FILE)) {
    console.log("No audit report found. Run: node scripts/audit-library.mjs");
    process.exit(1);
  }

  const report = JSON.parse(readFileSync(REPORT_FILE, "utf8"));
  const unreviewed = report.filter((r) => !r.reviewed);

  if (unreviewed.length === 0) {
    console.log("All items already reviewed.");
    const approved = report.filter((r) => r.approved);
    console.log(`${approved.length} approved for action. Run: node scripts/audit-library.mjs --apply`);
    return;
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Interactive Review");
  console.log(`  ${unreviewed.length} items to review (${report.length} total)`);
  console.log("  Commands: y=approve  n=reject  s=skip  q=save & quit");
  console.log("  Auto-approve: ya=all high  ym=all medium");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  // Offer batch approval for high-confidence items
  const highCount = unreviewed.filter((r) => r.confidence === "high" && r.action === "REMOVE").length;
  if (highCount > 0) {
    const ans = await ask(`\n${highCount} high-confidence removals. Auto-approve all? (ya/n) `);
    if (ans.trim().toLowerCase() === "ya") {
      for (const entry of report) {
        if (!entry.reviewed && entry.confidence === "high" && entry.action === "REMOVE") {
          entry.reviewed = true;
          entry.approved = true;
        }
      }
      console.log(`Auto-approved ${highCount} high-confidence removals.\n`);
      writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
    }
  }

  // Walk remaining unreviewed items
  const remaining = report.filter((r) => !r.reviewed);
  let idx = 0;

  for (const entry of remaining) {
    idx++;
    console.log(`\n[${idx}/${remaining.length}] ${entry.confidence.toUpperCase()} — ${entry.action}`);
    console.log(`  ${entry.year || "????"} ${entry.artist} — ${entry.title}`);
    if (entry.label) console.log(`  Label: ${entry.label}`);
    for (const issue of entry.issues) {
      console.log(`  ${issue.confidence} ${issue.type}: ${issue.reason}`);
    }

    const ans = await ask("  (y/n/s/q) ");
    const cmd = ans.trim().toLowerCase();

    if (cmd === "y") {
      entry.reviewed = true;
      entry.approved = true;
    } else if (cmd === "n") {
      entry.reviewed = true;
      entry.approved = false;
    } else if (cmd === "s") {
      // skip
    } else if (cmd === "q") {
      break;
    }

    // Auto-save every 20 reviews
    if (idx % 20 === 0) {
      writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
    }
  }

  writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  rl.close();

  const approved = report.filter((r) => r.approved).length;
  const rejected = report.filter((r) => r.reviewed && !r.approved).length;
  const pending = report.filter((r) => !r.reviewed).length;

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  Approved: ${approved}  Rejected: ${rejected}  Pending: ${pending}`);
  console.log("═══════════════════════════════════════════════════════════════");

  if (approved > 0) {
    console.log(`\nRun: node scripts/audit-library.mjs --apply`);
  }
}

// ─── Apply mode ──────────────────────────────────────────────────────

function applyReport() {
  if (!existsSync(REPORT_FILE)) {
    console.log("No audit report found. Run: node scripts/audit-library.mjs");
    process.exit(1);
  }

  const report = JSON.parse(readFileSync(REPORT_FILE, "utf8"));
  const albums = JSON.parse(readFileSync(ALBUMS_FILE, "utf8"));
  const quarantine = existsSync(QUARANTINE_FILE)
    ? JSON.parse(readFileSync(QUARANTINE_FILE, "utf8"))
    : [];

  const toRemove = new Set();
  const dateFixes = new Map();

  for (const entry of report) {
    if (!entry.approved) continue;
    if (entry.action === "REMOVE") {
      toRemove.add(entry.id);
    } else if (entry.action === "FIX_DATE" && entry.suggestedYear) {
      dateFixes.set(entry.id, entry.suggestedYear);
    }
  }

  if (toRemove.size === 0 && dateFixes.size === 0) {
    console.log("No approved actions to apply.");
    return;
  }

  const timestamp = new Date().toISOString();
  let removed = 0;
  let fixed = 0;
  const kept = [];

  for (const album of albums) {
    if (toRemove.has(album.id)) {
      const entry = report.find((r) => r.id === album.id);
      quarantine.push({
        ...album,
        quarantinedAt: timestamp,
        quarantineReason: entry.issues.map((i) => i.reason).join("; "),
      });
      removed++;
    } else {
      if (dateFixes.has(album.id)) {
        album.year = dateFixes.get(album.id);
        fixed++;
      }
      kept.push(album);
    }
  }

  writeFileSync(ALBUMS_FILE, JSON.stringify(kept, null, 2));
  writeFileSync(QUARANTINE_FILE, JSON.stringify(quarantine, null, 2));

  // Clear applied items from report
  const remaining = report.filter((r) => !r.approved);
  writeFileSync(REPORT_FILE, JSON.stringify(remaining, null, 2));

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Apply Complete");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Quarantined: ${removed} albums`);
  console.log(`  Date fixes:  ${fixed} albums`);
  console.log(`  Library:     ${kept.length} albums (was ${albums.length})`);
  console.log(`  Quarantine:  ${quarantine.length} total in ${QUARANTINE_FILE}`);
  console.log("═══════════════════════════════════════════════════════════════");
}

// ─── Backfill secondary types ────────────────────────────────────────

async function backfillTypes() {
  const albums = JSON.parse(readFileSync(ALBUMS_FILE, "utf8"));

  // Find albums missing secondaryTypes
  const needsBackfill = albums.filter(
    (a) => a.rgid && !a.secondaryTypes
  );

  // Load progress
  let startIdx = 0;
  if (existsSync(PROGRESS_FILE)) {
    const progress = JSON.parse(readFileSync(PROGRESS_FILE, "utf8"));
    startIdx = progress.lastIdx + 1;
    console.log(`Resuming from album ${startIdx + 1}\n`);
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Backfill MusicBrainz Secondary Types");
  console.log(`  ${needsBackfill.length} albums need type data (starting from ${startIdx + 1})`);
  console.log(`  Estimated: ~${Math.ceil((needsBackfill.length - startIdx) * 1.1 / 60)} min`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Build rgid → album index for efficient updates
  const rgidToAlbums = new Map();
  for (const album of albums) {
    if (album.rgid) {
      if (!rgidToAlbums.has(album.rgid)) rgidToAlbums.set(album.rgid, []);
      rgidToAlbums.get(album.rgid).push(album);
    }
  }

  let fetched = 0;
  let errors = 0;

  for (let i = startIdx; i < needsBackfill.length; i++) {
    const album = needsBackfill[i];
    process.stdout.write(
      `[${i + 1}/${needsBackfill.length}] ${album.artist} — ${album.title}\r`
    );

    try {
      const url = `${MB_BASE}/release-group/${album.rgid}?fmt=json`;
      const res = await mbFetch(url);
      const rg = await res.json();
      const types = rg["secondary-types"] || [];

      // Apply to all albums sharing this rgid
      const targets = rgidToAlbums.get(album.rgid) || [album];
      for (const target of targets) {
        target.secondaryTypes = types;
      }
      fetched++;
    } catch (e) {
      // Set empty array so we don't retry
      album.secondaryTypes = [];
      errors++;
    }

    // Save progress every 50 albums
    if (i % 50 === 49) {
      writeFileSync(ALBUMS_FILE, JSON.stringify(albums, null, 2));
      writeFileSync(PROGRESS_FILE, JSON.stringify({ lastIdx: i }));
      process.stdout.write(`  [saved at ${i + 1}]\n`);
    }
  }

  // Final save
  writeFileSync(ALBUMS_FILE, JSON.stringify(albums, null, 2));
  if (existsSync(PROGRESS_FILE)) {
    const { unlinkSync } = await import("fs");
    unlinkSync(PROGRESS_FILE);
  }

  // Count results
  const withTypes = albums.filter(
    (a) => a.secondaryTypes && a.secondaryTypes.length > 0
  );
  const typeBreakdown = {};
  for (const a of withTypes) {
    for (const t of a.secondaryTypes) {
      typeBreakdown[t] = (typeBreakdown[t] || 0) + 1;
    }
  }

  console.log("\n\n═══════════════════════════════════════════════════════════════");
  console.log("  Backfill Complete");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Fetched: ${fetched}  Errors: ${errors}  API calls: ${apiCalls}`);
  console.log(`  Albums with secondary types: ${withTypes.length}`);
  for (const [type, count] of Object.entries(typeBreakdown).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type}: ${count}`);
  }
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`\nNext: node scripts/audit-library.mjs`);
}

// ─── Run ─────────────────────────────────────────────────────────────

if (MODE_BACKFILL) {
  backfillTypes().catch((e) => { console.error("Error:", e); process.exit(1); });
} else if (MODE_REVIEW) {
  reviewReport().catch((e) => { console.error("Error:", e); process.exit(1); });
} else if (MODE_APPLY) {
  applyReport();
} else if (MODE_STATS) {
  showStats();
} else {
  scanLibrary().catch((e) => { console.error("Error:", e); process.exit(1); });
}
