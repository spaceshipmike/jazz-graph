#!/usr/bin/env node

/**
 * Reggae subgenre audit
 *
 * Builds a temporary reggae corpus from a curated artist roster, then compares:
 *   - Discogs genre/style
 *   - MusicBrainz release-group genres
 *   - MusicBrainz artist genres (fallback/context only)
 *
 * Outputs:
 *   - data/reggae-audit/albums.json
 *   - data/reggae-audit/summary.json
 *   - data/reggae-audit/report.md
 *
 * Usage:
 *   node scripts/audit-reggae-subgenres.mjs
 *   node scripts/audit-reggae-subgenres.mjs --resume
 *   node scripts/audit-reggae-subgenres.mjs --target 60
 *   node scripts/audit-reggae-subgenres.mjs --roster data/reggae-audit-roster.json
 *   node scripts/audit-reggae-subgenres.mjs --help
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DEFAULT_ROSTER_FILE = join(ROOT, "data", "reggae-audit-roster.json");
const OUTPUT_DIR = join(ROOT, "data", "reggae-audit");
const ALBUMS_OUTPUT = join(OUTPUT_DIR, "albums.json");
const SUMMARY_OUTPUT = join(OUTPUT_DIR, "summary.json");
const REPORT_OUTPUT = join(OUTPUT_DIR, "report.md");
const PROGRESS_OUTPUT = join(OUTPUT_DIR, "progress.json");

const MB_BASE = "https://musicbrainz.org/ws/2";
const MB_UA = "TheJazzGraph/0.1 ( reggae-audit@h3r3.com )";
const DISCOGS_BASE = "https://api.discogs.com";
const DISCOGS_UA = "TheJazzGraph/0.1 +https://jazz.h3r3.com";
const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN || "";

const DEFAULT_TARGET = 60;
const DISCOGS_RATE_MS = DISCOGS_TOKEN ? 1100 : 3000;
const MB_RATE_MS = 1100;

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(`Usage:
  node scripts/audit-reggae-subgenres.mjs [--resume] [--target 60] [--roster data/reggae-audit-roster.json]
`);
  process.exit(0);
}

const RESUME = args.includes("--resume");
const targetIdx = args.indexOf("--target");
const rosterIdx = args.indexOf("--roster");
const TARGET = targetIdx >= 0 ? Math.max(1, parseInt(args[targetIdx + 1], 10) || DEFAULT_TARGET) : DEFAULT_TARGET;
const ROSTER_FILE = rosterIdx >= 0 ? join(ROOT, args[rosterIdx + 1]) : DEFAULT_ROSTER_FILE;

const CANONICAL = ["roots reggae", "dub", "unmapped"];
const SOURCE_PRECEDENCE = ["discogs.style", "musicbrainz.release_group.genres", "musicbrainz.artist.genres"];

const NORMALIZE = {
  // Discogs / MB raw labels -> canonical
  "roots reggae": "roots reggae",
  "root reggae": "roots reggae",
  "dub": "dub",
  "dub poetry": "dub",
};

const SKIP_SECONDARY_TYPES = new Set([
  "Compilation",
  "Live",
  "Remix",
  "DJ-mix",
  "Mixtape/Street",
  "Demo",
  "Soundtrack",
]);

let discogsLast = 0;
let mbLast = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureOutputDir() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

function parseJSON(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadRoster() {
  const roster = parseJSON(ROSTER_FILE);
  return roster.artists || [];
}

function loadProgress() {
  if (RESUME && existsSync(PROGRESS_OUTPUT)) {
    return parseJSON(PROGRESS_OUTPUT);
  }
  return {
    artists: {},
    artistGenres: {},
    albums: {},
  };
}

function saveProgress(progress) {
  writeFileSync(PROGRESS_OUTPUT, JSON.stringify(progress, null, 2) + "\n");
}

function writeJSON(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

function slugify(value) {
  return (value || "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function albumKey(artist, title, year) {
  return `${slugify(artist)}|${slugify(title)}|${year || "unknown"}`;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function lowerList(values) {
  return uniqueSorted((values || []).map((value) => String(value).trim().toLowerCase()));
}

function normalizeLabels(rawLabels) {
  const matched = new Set();
  const unmapped = [];

  for (const raw of rawLabels || []) {
    const normalized = NORMALIZE[String(raw).trim().toLowerCase()];
    if (normalized) matched.add(normalized);
    else unmapped.push(raw);
  }

  const result = [...matched].sort((a, b) => a.localeCompare(b));
  return {
    matched: result,
    unmapped: uniqueSorted(unmapped),
  };
}

function buildConfidenceNote(album) {
  if (album.flags.noUsableSignal) return "No usable source-backed pilot tags found.";
  if (album.flags.multiTagged) return "Multiple pilot subgenres matched for the album.";
  if (album.flags.conflictBetweenAlbumSources) return "Discogs and MusicBrainz release-group disagree after normalization.";
  if (album.flags.artistFallbackOnly) return "Only artist-level fallback produced a pilot tag; not album-truth.";
  if (album.flags.albumSourcesAgree) return "Discogs and MusicBrainz release-group agree on the pilot tag.";
  if (album.flags.discogsUsable && !album.flags.mbReleaseGroupUsable) return "Only Discogs provided usable album-level pilot evidence.";
  if (!album.flags.discogsUsable && album.flags.mbReleaseGroupUsable) return "Only MusicBrainz release-group provided usable album-level pilot evidence.";
  return "Partial source signal; needs manual review.";
}

function inferRecommendation(summary) {
  const majority = summary.coverage.albumLevelUsable / summary.totals.albums >= 0.5;
  const agreementRate = summary.coverage.bothUsable > 0
    ? summary.coverage.albumSourceAgreement / summary.coverage.bothUsable
    : 0;
  const fallbackIsWeaker = summary.coverage.artistFallbackOnly < summary.coverage.albumLevelUsable;

  if (majority && agreementRate >= 0.6 && fallbackIsWeaker) {
    return "Proceed with source-backed album subgenre tagging";
  }
  if (summary.coverage.albumLevelUsable > 0) {
    return "Proceed only with source + manual curation";
  }
  return "Do not proceed yet; source signal too weak";
}

async function mbFetch(url) {
  const wait = Math.max(0, MB_RATE_MS - (Date.now() - mbLast));
  if (wait > 0) await sleep(wait);
  mbLast = Date.now();

  const res = await fetch(url, {
    headers: { "User-Agent": MB_UA, Accept: "application/json" },
  });

  if (res.status === 503 || res.status === 429) {
    await sleep(5000);
    return mbFetch(url);
  }
  if (!res.ok) {
    throw new Error(`MusicBrainz HTTP ${res.status}`);
  }
  return res.json();
}

async function discogsFetch(url) {
  const wait = Math.max(0, DISCOGS_RATE_MS - (Date.now() - discogsLast));
  if (wait > 0) await sleep(wait);
  discogsLast = Date.now();

  const res = await fetch(url, {
    headers: { "User-Agent": DISCOGS_UA },
  });

  if (res.status === 429) {
    await sleep(60000);
    return discogsFetch(url);
  }
  if (!res.ok) {
    throw new Error(`Discogs HTTP ${res.status}`);
  }
  return res.json();
}

async function findArtist(name) {
  const query = encodeURIComponent(`artist:"${name}"`);
  const data = await mbFetch(`${MB_BASE}/artist/?query=${query}&fmt=json&limit=5`);
  const artists = data.artists || [];
  const exact = artists.find((artist) => artist.name.toLowerCase() === name.toLowerCase());
  return exact || artists[0] || null;
}

async function fetchArtistDiscography(artistId) {
  const releaseGroups = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const data = await mbFetch(`${MB_BASE}/release-group/?artist=${artistId}&type=album&fmt=json&limit=${limit}&offset=${offset}`);
    const groups = data["release-groups"] || [];
    if (groups.length === 0) break;

    for (const group of groups) {
      releaseGroups.push({
        rgid: group.id,
        title: group.title,
        year: group["first-release-date"]?.slice(0, 4) || null,
        secondaryTypes: group["secondary-types"] || [],
        primaryType: group["primary-type"] || "Album",
      });
    }

    offset += limit;
    if (offset >= (data["release-group-count"] || 0)) break;
  }

  return releaseGroups;
}

function isCanonicalStudioAlbum(group) {
  if (group.primaryType !== "Album") return false;
  return !group.secondaryTypes.some((type) => SKIP_SECONDARY_TYPES.has(type));
}

async function fetchMbReleaseGroupGenres(rgid) {
  const data = await mbFetch(`${MB_BASE}/release-group/${rgid}?inc=genres&fmt=json`);
  return lowerList((data.genres || []).map((genre) => genre.name));
}

async function fetchMbArtistGenres(artistId) {
  const data = await mbFetch(`${MB_BASE}/artist/${artistId}?inc=genres&fmt=json`);
  return lowerList((data.genres || []).map((genre) => genre.name));
}

async function searchDiscogsRelease(artist, title, year) {
  const params = new URLSearchParams({
    artist,
    release_title: title,
    type: "master",
    per_page: "5",
  });
  if (DISCOGS_TOKEN) params.set("token", DISCOGS_TOKEN);
  if (year) params.set("year", String(year));

  const data = await discogsFetch(`${DISCOGS_BASE}/database/search?${params}`);
  const results = data.results || [];

  const exactTitle = results.find((result) =>
    String(result.title || "").toLowerCase().includes(String(title).toLowerCase())
  );
  const hit = exactTitle || results[0];
  if (!hit) return null;

  return {
    id: hit.id || null,
    title: hit.title || null,
    year: hit.year || null,
    genre: uniqueSorted(hit.genre || []),
    style: uniqueSorted(hit.style || []),
  };
}

function selectAuditAlbums(rosterAlbums, target) {
  const selected = [];
  const seen = new Set();
  const queues = rosterAlbums.map(({ artist, artistId, albums }) => ({
    artist,
    artistId,
    albums: albums
      .filter((album) => !/\balt\.?\s*version\b/i.test(album.title))
      .map((album) => ({
        artist,
        artistId,
        title: album.title,
        year: album.year ? parseInt(album.year, 10) : null,
        rgid: album.rgid,
        secondaryTypes: album.secondaryTypes,
      })),
    idx: 0,
  }));

  while (selected.length < target) {
    let addedThisPass = 0;

    for (const queue of queues) {
      while (queue.idx < queue.albums.length) {
        const album = queue.albums[queue.idx++];
        const key = `${slugify(album.artist)}|${slugify(album.title)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        selected.push(album);
        addedThisPass++;
        break;
      }

      if (selected.length >= target) break;
    }

    if (addedThisPass === 0) break;
  }

  return selected;
}

function summarizeAlbums(albums) {
  const topUnmappedRawLabels = new Map();
  const manualReview = [];

  const coverage = {
    discogsUsable: 0,
    mbReleaseGroupUsable: 0,
    bothUsable: 0,
    albumSourceAgreement: 0,
    albumSourceConflict: 0,
    artistFallbackOnly: 0,
    unmapped: 0,
    albumLevelUsable: 0,
    multiTagged: 0,
  };

  for (const album of albums) {
    if (album.flags.discogsUsable) coverage.discogsUsable++;
    if (album.flags.mbReleaseGroupUsable) coverage.mbReleaseGroupUsable++;
    if (album.flags.discogsUsable && album.flags.mbReleaseGroupUsable) coverage.bothUsable++;
    if (album.flags.albumSourcesAgree) coverage.albumSourceAgreement++;
    if (album.flags.conflictBetweenAlbumSources) coverage.albumSourceConflict++;
    if (album.flags.artistFallbackOnly) coverage.artistFallbackOnly++;
    if (album.flags.noUsableSignal) coverage.unmapped++;
    if (album.flags.albumLevelUsable) coverage.albumLevelUsable++;
    if (album.flags.multiTagged) coverage.multiTagged++;

    for (const label of album.normalized.unmappedRawLabels) {
      topUnmappedRawLabels.set(label, (topUnmappedRawLabels.get(label) || 0) + 1);
    }

    if (
      album.flags.conflictBetweenAlbumSources ||
      album.flags.artistFallbackOnly ||
      album.flags.multiTagged ||
      album.flags.noUsableSignal
    ) {
      manualReview.push({
        album: `${album.artist} — ${album.title}`,
        normalized: album.normalized.candidateTags,
        reason: album.confidenceNote,
      });
    }
  }

  const unmapped = [...topUnmappedRawLabels.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20)
    .map(([label, count]) => ({ label, count }));

  const summary = {
    generatedAt: new Date().toISOString(),
    scope: {
      umbrellaGenre: "reggae",
      pilotSubgenres: ["roots reggae", "dub"],
      targetAlbums: TARGET,
      sourcePrecedence: SOURCE_PRECEDENCE,
    },
    totals: {
      artists: uniqueSorted(albums.map((album) => album.artist)).length,
      albums: albums.length,
    },
    coverage,
    topUnmappedRawLabels: unmapped,
    manualReview: manualReview.slice(0, 25),
  };

  summary.recommendation = inferRecommendation(summary);
  return summary;
}

function buildMarkdownReport(summary, albums, roster) {
  const agreementRate = summary.coverage.bothUsable > 0
    ? ((summary.coverage.albumSourceAgreement / summary.coverage.bothUsable) * 100).toFixed(1)
    : "0.0";

  const q = [];
  q.push(`# Reggae Subgenre Audit`);
  q.push("");
  q.push(`Generated: ${summary.generatedAt}`);
  q.push("");
  q.push(`## Summary`);
  q.push("");
  q.push(`- Umbrella genre: reggae`);
  q.push(`- Pilot subgenres: roots reggae, dub`);
  q.push(`- Artist roster size: ${roster.length}`);
  q.push(`- Album sample size: ${summary.totals.albums}`);
  q.push(`- Recommendation: **${summary.recommendation}**`);
  q.push("");
  q.push(`## Source Coverage`);
  q.push("");
  q.push(`- Albums with usable Discogs subgenre evidence: **${summary.coverage.discogsUsable}**`);
  q.push(`- Albums with usable MusicBrainz release-group evidence: **${summary.coverage.mbReleaseGroupUsable}**`);
  q.push(`- Albums with both usable album-level sources: **${summary.coverage.bothUsable}**`);
  q.push(`- Album-level usable pilot tags from either source: **${summary.coverage.albumLevelUsable}**`);
  q.push(`- Albums only classifiable via artist fallback: **${summary.coverage.artistFallbackOnly}**`);
  q.push(`- Albums with no usable source-backed pilot tags: **${summary.coverage.unmapped}**`);
  q.push("");
  q.push(`## Source Agreement`);
  q.push("");
  q.push(`- Album-level agreement after normalization: **${summary.coverage.albumSourceAgreement}**`);
  q.push(`- Album-level disagreement after normalization: **${summary.coverage.albumSourceConflict}**`);
  q.push(`- Agreement rate where both album-level sources are usable: **${agreementRate}%**`);
  q.push(`- Multi-tagged albums (roots reggae + dub): **${summary.coverage.multiTagged}**`);
  q.push("");
  q.push(`## Normalization Table`);
  q.push("");
  q.push(`- roots reggae <- roots reggae, root reggae`);
  q.push(`- dub <- dub, dub poetry`);
  q.push(`- unmapped <- any other raw label`);
  q.push("");
  q.push(`## Raw Labels To Consider As Future Aliases`);
  q.push("");
  if (summary.topUnmappedRawLabels.length === 0) {
    q.push(`- None`);
  } else {
    for (const entry of summary.topUnmappedRawLabels) {
      q.push(`- ${entry.label}: ${entry.count}`);
    }
  }
  q.push("");
  q.push(`## Manual Review Candidates`);
  q.push("");
  if (summary.manualReview.length === 0) {
    q.push(`- None`);
  } else {
    for (const item of summary.manualReview) {
      const tags = item.normalized.length > 0 ? item.normalized.join(", ") : "unmapped";
      q.push(`- ${item.album} -> ${tags} (${item.reason})`);
    }
  }
  q.push("");
  q.push(`## Audit Questions Answered`);
  q.push("");
  q.push(`- How many albums have usable Discogs subgenre evidence? ${summary.coverage.discogsUsable}`);
  q.push(`- How many have usable MusicBrainz release-group evidence? ${summary.coverage.mbReleaseGroupUsable}`);
  q.push(`- How many have both? ${summary.coverage.bothUsable}`);
  q.push(`- How often do Discogs and MB agree after normalization? ${summary.coverage.albumSourceAgreement}/${summary.coverage.bothUsable || 0}`);
  q.push(`- How often do they disagree? ${summary.coverage.albumSourceConflict}/${summary.coverage.bothUsable || 0}`);
  q.push(`- How many albums are only classifiable via artist-level fallback? ${summary.coverage.artistFallbackOnly}`);
  q.push(`- How many albums remain unmapped? ${summary.coverage.unmapped}`);
  q.push(`- Which raw labels appear most often and should become normalization aliases? See 'Raw Labels To Consider As Future Aliases' above.`);
  q.push(`- Is roots reggae + dub viable as a source-backed album tagging pilot? ${summary.recommendation}`);
  q.push("");
  q.push(`## Sample Snapshot`);
  q.push("");

  const sample = albums.slice(0, 12);
  for (const album of sample) {
    const tags = album.normalized.candidateTags.length > 0 ? album.normalized.candidateTags.join(", ") : "unmapped";
    q.push(`- ${album.artist} — ${album.title} (${album.year || "?"}) -> ${tags}`);
  }

  q.push("");
  return q.join("\n");
}

async function main() {
  ensureOutputDir();

  const roster = loadRoster();
  const progress = loadProgress();

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Reggae Subgenre Audit");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Roster: ${ROSTER_FILE}`);
  console.log(`Target albums: ${TARGET}`);
  console.log(`Discogs token configured: ${DISCOGS_TOKEN ? "yes" : "no"}`);
  console.log();

  const rosterAlbums = [];

  for (const artistName of roster) {
    let cachedArtist = progress.artists[artistName];
    if (!cachedArtist) {
      const artist = await findArtist(artistName);
      if (!artist) {
        throw new Error(`Could not find artist on MusicBrainz: ${artistName}`);
      }

      const discography = await fetchArtistDiscography(artist.id);
      const albums = discography
        .filter(isCanonicalStudioAlbum)
        .sort((a, b) => (parseInt(a.year || "9999", 10) - parseInt(b.year || "9999", 10)) || a.title.localeCompare(b.title));

      cachedArtist = {
        artistId: artist.id,
        resolvedName: artist.name,
        albums,
      };
      progress.artists[artistName] = cachedArtist;
      saveProgress(progress);
    }

    rosterAlbums.push({
      artist: cachedArtist.resolvedName || artistName,
      artistId: cachedArtist.artistId,
      albums: cachedArtist.albums || [],
    });
  }

  const selected = selectAuditAlbums(rosterAlbums, TARGET);
  if (selected.length === 0) {
    throw new Error("No albums were selected for the audit.");
  }

  console.log(`Selected ${selected.length} albums for audit.\n`);

  const auditedAlbums = [];

  for (let i = 0; i < selected.length; i++) {
    const album = selected[i];
    const key = albumKey(album.artist, album.title, album.year);
    const prefix = `[${i + 1}/${selected.length}]`;

    let cached = progress.albums[key];
    if (!cached) {
      console.log(`${prefix} ${album.artist} — ${album.title}`);

      const discogs = await searchDiscogsRelease(album.artist, album.title, album.year);
      const mbReleaseGroupGenres = album.rgid ? await fetchMbReleaseGroupGenres(album.rgid) : [];

      let mbArtistGenres = progress.artistGenres[album.artist];
      if (!mbArtistGenres) {
        mbArtistGenres = await fetchMbArtistGenres(album.artistId);
        progress.artistGenres[album.artist] = mbArtistGenres;
        saveProgress(progress);
      }

      cached = {
        ...album,
        discogs: {
          genre: discogs?.genre || [],
          style: discogs?.style || [],
          matchedTitle: discogs?.title || null,
        },
        musicbrainz: {
          releaseGroupGenres: mbReleaseGroupGenres,
          artistGenres: mbArtistGenres,
        },
      };

      progress.albums[key] = cached;
      saveProgress(progress);
    }

    const discogsRaw = [...(cached.discogs.genre || []), ...(cached.discogs.style || [])];
    const mbRgRaw = cached.musicbrainz.releaseGroupGenres || [];
    const mbArtistRaw = cached.musicbrainz.artistGenres || [];

    const discogsNormalized = normalizeLabels(discogsRaw);
    const mbReleaseNormalized = normalizeLabels(mbRgRaw);
    const mbArtistNormalized = normalizeLabels(mbArtistRaw);

    const albumLevelCandidateTags = uniqueSorted([
      ...discogsNormalized.matched,
      ...mbReleaseNormalized.matched,
    ]);
    const candidateTags = albumLevelCandidateTags.length > 0
      ? albumLevelCandidateTags
      : [...mbArtistNormalized.matched];

    const discogsUsable = discogsNormalized.matched.length > 0;
    const mbReleaseUsable = mbReleaseNormalized.matched.length > 0;
    const artistFallbackUsable = mbArtistNormalized.matched.length > 0;
    const bothUsable = discogsUsable && mbReleaseUsable;
    const albumSourcesAgree = bothUsable &&
      JSON.stringify(discogsNormalized.matched) === JSON.stringify(mbReleaseNormalized.matched);
    const conflictBetweenAlbumSources = bothUsable && !albumSourcesAgree;
    const albumLevelUsable = albumLevelCandidateTags.length > 0;
    const artistFallbackOnly = !albumLevelUsable && artistFallbackUsable;
    const noUsableSignal = candidateTags.length === 0;
    const multiTagged = candidateTags.length > 1;

    const audited = {
      id: key,
      title: cached.title,
      artist: cached.artist,
      year: cached.year,
      rgid: cached.rgid || null,
      canonicalGenre: "reggae",
      pilotSubgenres: ["roots reggae", "dub"],
      raw: {
        discogs: {
          genre: cached.discogs.genre || [],
          style: cached.discogs.style || [],
        },
        musicbrainz: {
          releaseGroupGenres: cached.musicbrainz.releaseGroupGenres || [],
          artistGenres: cached.musicbrainz.artistGenres || [],
        },
      },
      normalized: {
        discogs: discogsNormalized.matched,
        musicbrainzReleaseGroup: mbReleaseNormalized.matched,
        musicbrainzArtist: mbArtistNormalized.matched,
        candidateTags,
        albumLevelCandidateTags,
        unmappedRawLabels: uniqueSorted([
          ...discogsNormalized.unmapped,
          ...mbReleaseNormalized.unmapped,
          ...mbArtistNormalized.unmapped,
        ]),
      },
      flags: {
        discogsUsable,
        mbReleaseGroupUsable: mbReleaseUsable,
        bothUsable,
        albumSourcesAgree,
        conflictBetweenAlbumSources,
        albumLevelUsable,
        artistFallbackOnly,
        noUsableSignal,
        multiTagged,
      },
    };

    audited.confidenceNote = buildConfidenceNote(audited);
    auditedAlbums.push(audited);
  }

  const summary = summarizeAlbums(auditedAlbums);
  const report = buildMarkdownReport(summary, auditedAlbums, roster);

  writeJSON(ALBUMS_OUTPUT, auditedAlbums);
  writeJSON(SUMMARY_OUTPUT, summary);
  writeFileSync(REPORT_OUTPUT, report);

  console.log("Audit complete.");
  console.log(`Albums artifact: ${ALBUMS_OUTPUT}`);
  console.log(`Summary artifact: ${SUMMARY_OUTPUT}`);
  console.log(`Report artifact: ${REPORT_OUTPUT}`);
  console.log(`Recommendation: ${summary.recommendation}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
