#!/usr/bin/env node

/**
 * Jazz researcher — cross-references MusicBrainz + Wikidata to classify
 * flagged albums as REMOVE, KEEP, or FIX_DATE.
 *
 * Usage:
 *   node scripts/research-albums.mjs              # research all flagged
 *   node scripts/research-albums.mjs --apply      # apply recommendations
 *   node scripts/research-albums.mjs --id <id>    # research single album
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "..", "data", "albums.json");
const REPORT_FILE = join(__dirname, "..", "data", "reissue-report.json");
const UA = "TheJazzGraph/0.1.0 (https://github.com/jazz-graph)";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── MusicBrainz ────────────────────────────────────────────────────

async function mbReleaseGroup(rgid) {
  const url = `https://musicbrainz.org/ws/2/release-group/${rgid}?fmt=json&inc=releases`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  return res.json();
}

async function mbReleaseGroupRels(rgid) {
  const url = `https://musicbrainz.org/ws/2/release-group/${rgid}?fmt=json&inc=url-rels`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  return res.json();
}

// ─── Wikidata ───────────────────────────────────────────────────────

async function wikidataFromMBID(rgid) {
  // SPARQL: find Wikidata item linked to this MusicBrainz release group
  const sparql = `
    SELECT ?item ?itemLabel ?inception ?pubDate ?instanceOf ?instanceOfLabel WHERE {
      ?item wdt:P436 "${rgid}" .
      OPTIONAL { ?item wdt:P571 ?inception . }
      OPTIONAL { ?item wdt:P577 ?pubDate . }
      OPTIONAL { ?item wdt:P31 ?instanceOf . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
    } LIMIT 5
  `;
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.bindings || [];
  } catch {
    return null;
  }
}

async function wikidataSearch(title, artist) {
  // Fallback: search Wikidata by title + artist
  const query = `${title} ${artist} album`;
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&type=item&limit=3&format=json`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.search || [];
  } catch {
    return [];
  }
}

async function wikidataEntity(qid) {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.entities?.[qid] || null;
  } catch {
    return null;
  }
}

// ─── Wikipedia ──────────────────────────────────────────────────────

async function wikipediaExtract(title, artist) {
  // Search Wikipedia for the album article
  const query = `${title} ${artist} album`;
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=3`;
  try {
    const res = await fetch(searchUrl, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.query?.search || [];
    if (results.length === 0) return null;

    // Get extract of first result
    const pageId = results[0].pageid;
    const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageId}&prop=extracts&exintro=true&explaintext=true&format=json`;
    const res2 = await fetch(extractUrl, { headers: { "User-Agent": UA } });
    if (!res2.ok) return null;
    const data2 = await res2.json();
    const page = data2.query?.pages?.[pageId];
    return page ? { title: page.title, extract: page.extract?.substring(0, 1000) } : null;
  } catch {
    return null;
  }
}

// ─── Classifier ─────────────────────────────────────────────────────

function classify(mbData, wdBindings, wikiExtract, album) {
  const result = {
    action: "UNKNOWN",
    confidence: "low",
    reason: [],
    suggestedYear: null,
  };

  // MusicBrainz secondary types
  if (mbData) {
    const secondaryTypes = mbData["secondary-types"] || [];
    if (secondaryTypes.includes("Compilation")) {
      result.action = "REMOVE";
      result.confidence = "high";
      result.reason.push(`MB: Compilation type`);
    }
    if (secondaryTypes.includes("Live")) {
      result.reason.push(`MB: Live recording`);
    }

    // Check first release date vs album year
    const firstRelease = mbData["first-release-date"];
    if (firstRelease) {
      const firstYear = parseInt(firstRelease.slice(0, 4), 10);
      if (firstYear < album.year) {
        result.suggestedYear = firstYear;
        result.reason.push(`MB: first-release-date ${firstRelease} < album year ${album.year}`);
      }
    }

    // Multiple releases suggest reissues exist
    const releaseCount = mbData.releases?.length || 0;
    if (releaseCount > 5) {
      result.reason.push(`MB: ${releaseCount} releases (many reissues)`);
    }
  }

  // Wikidata classification
  if (wdBindings && wdBindings.length > 0) {
    for (const binding of wdBindings) {
      const instanceLabel = binding.instanceOfLabel?.value || "";
      if (/compilation/i.test(instanceLabel)) {
        result.action = "REMOVE";
        result.confidence = "high";
        result.reason.push(`WD: instance of "${instanceLabel}"`);
      }
      if (/greatest hits/i.test(instanceLabel)) {
        result.action = "REMOVE";
        result.confidence = "high";
        result.reason.push(`WD: instance of "${instanceLabel}"`);
      }

      // Recording/inception date
      const inception = binding.inception?.value;
      if (inception) {
        const incYear = parseInt(inception.slice(0, 4), 10);
        if (incYear < album.year && (!result.suggestedYear || incYear < result.suggestedYear)) {
          result.suggestedYear = incYear;
          result.reason.push(`WD: inception date ${inception.slice(0, 10)}`);
        }
      }

      const pubDate = binding.pubDate?.value;
      if (pubDate) {
        const pubYear = parseInt(pubDate.slice(0, 4), 10);
        if (pubYear < album.year) {
          result.suggestedYear = result.suggestedYear
            ? Math.min(result.suggestedYear, pubYear)
            : pubYear;
          result.reason.push(`WD: publication date ${pubDate.slice(0, 10)}`);
        }
      }
    }
  }

  // Wikipedia extract analysis
  if (wikiExtract?.extract) {
    const text = wikiExtract.extract.toLowerCase();
    if (/compilation album/i.test(text)) {
      result.action = "REMOVE";
      result.confidence = "high";
      result.reason.push(`Wiki: described as "compilation album"`);
    }
    if (/greatest hits/i.test(text)) {
      result.action = "REMOVE";
      result.confidence = "high";
      result.reason.push(`Wiki: described as "greatest hits"`);
    }
    if (/previously unreleased/i.test(text) || /unreleased recordings/i.test(text)) {
      result.action = "KEEP";
      result.confidence = "medium";
      result.reason.push(`Wiki: mentions "unreleased recordings"`);
    }
    if (/posthumous/i.test(text)) {
      result.reason.push(`Wiki: mentions "posthumous"`);
    }

    // Try to extract recording year from "recorded in YYYY" or "recorded YYYY"
    const recordedMatch = text.match(/recorded (?:in |on |at )?(?:\w+ )?(\d{4})/);
    if (recordedMatch) {
      const recYear = parseInt(recordedMatch[1], 10);
      if (recYear < album.year) {
        result.suggestedYear = result.suggestedYear
          ? Math.min(result.suggestedYear, recYear)
          : recYear;
        result.reason.push(`Wiki: recorded ${recYear}`);
      }
    }
  }

  // Final classification logic
  if (result.action === "UNKNOWN") {
    if (result.suggestedYear && result.suggestedYear < album.year - 2) {
      result.action = "FIX_DATE";
      result.confidence = "medium";
    } else {
      result.action = "REMOVE";
      result.confidence = "low";
      result.reason.push("no evidence of original recording — likely reissue/compilation");
    }
  }

  return result;
}

// ─── Main ───────────────────────────────────────────────────────────

const DEATHS = {
  "Charlie Parker": 1955, "Billie Holiday": 1959, "Lester Young": 1959,
  "Eric Dolphy": 1964, "Bud Powell": 1966, "John Coltrane": 1967,
  "Wes Montgomery": 1968, "Coleman Hawkins": 1969, "Ben Webster": 1973,
  "Duke Ellington": 1974, "Cannonball Adderley": 1975, "Paul Desmond": 1977,
  "Charles Mingus": 1979, "Bill Evans": 1980, "Art Pepper": 1982,
  "Thelonious Monk": 1982, "Count Basie": 1984, "Red Garland": 1984,
  "Hank Mobley": 1986, "Benny Goodman": 1986, "Jaco Pastorius": 1987,
  "Chet Baker": 1988, "Woody Shaw": 1989, "Dexter Gordon": 1990,
  "Art Blakey": 1990, "Sarah Vaughan": 1990, "Miles Davis": 1991,
  "Dizzy Gillespie": 1993, "Sun Ra": 1993, "Ella Fitzgerald": 1996,
  "Joe Henderson": 2001, "Jimmy Smith": 2005, "Freddie Hubbard": 2008,
  "Horace Silver": 2014, "Ornette Coleman": 2015, "Bobby Hutcherson": 2016,
  "McCoy Tyner": 2020, "Chick Corea": 2021, "Lee Morgan": 1972,
  "Kenny Dorham": 1972, "Booker Little": 1961, "Clifford Brown": 1956,
};

const COMP_RE = /\b(complete|essential|best of|greatest hits?|collection|anthology|remaster|deluxe|bonus tracks?|4 originals|original sessions?|original recordings?|jazz greats|jazz masters|jazz profile|jazz tribune|jazz studies|star power|indispensable|i grandi del jazz|bd music presents|jazz do it|jazz six pack|columbia jazz|cool and iconic|greatest jazz|cool too|pop classics|big bands? greatest|gold collection|super session|all my life|first lady of song|reprise years)\b/i;

const KEEP_LIST = new Set([
  "eric-dolphy-other-aspects",
  "duke-ellington-his-orchestra-the-afro-eurasian-eclipse",
  "eric-dolphy-stockholm-sessions",
  "eric-dolphy-candid-dolphy",
]);

const albums = JSON.parse(readFileSync(DATA_FILE, "utf8"));
const applyMode = process.argv.includes("--apply");
const singleId = process.argv.includes("--id")
  ? process.argv[process.argv.indexOf("--id") + 1]
  : null;

// Find flagged albums
const flaggedIds = new Set();
for (const a of albums) {
  if (singleId && a.id !== singleId) continue;
  if (singleId) { flaggedIds.add(a.id); continue; }
  if (a.year && a.year < 1980) continue;
  if (KEEP_LIST.has(a.id)) continue;
  let dominated = false;
  if (a.year && a.artist) {
    for (const [artist, dy] of Object.entries(DEATHS)) {
      if (a.artist.includes(artist) && a.year > dy + 10) { dominated = true; break; }
    }
  }
  if (dominated || COMP_RE.test(a.title)) flaggedIds.add(a.id);
}

const flagged = albums.filter((a) => flaggedIds.has(a.id));

console.log("=".repeat(65));
console.log("  Jazz Researcher — MusicBrainz + Wikidata + Wikipedia");
console.log(`  ${flagged.length} albums to research`);
console.log("=".repeat(65));
console.log();

const report = [];

for (let i = 0; i < flagged.length; i++) {
  const album = flagged[i];
  const prefix = `[${i + 1}/${flagged.length}]`;

  console.log(`${prefix} Researching: ${album.title} — ${album.artist} (${album.year})`);

  // MusicBrainz
  let mbData = null;
  if (album.rgid) {
    mbData = await mbReleaseGroup(album.rgid);
    await sleep(1100);
  }

  // Wikidata via MBID
  let wdBindings = null;
  if (album.rgid) {
    wdBindings = await wikidataFromMBID(album.rgid);
    await sleep(500);
  }

  // Wikipedia
  const wikiExtract = await wikipediaExtract(album.title, album.artist);
  await sleep(500);

  // Classify
  const result = classify(mbData, wdBindings, wikiExtract, album);

  const entry = {
    id: album.id,
    title: album.title,
    artist: album.artist,
    year: album.year,
    ...result,
  };
  report.push(entry);

  const icon = result.action === "REMOVE" ? "X" : result.action === "KEEP" ? "+" : "~";
  console.log(
    `  ${icon} ${result.action} (${result.confidence}) ${result.suggestedYear ? `-> ${result.suggestedYear}` : ""}`
  );
  for (const r of result.reason) console.log(`    ${r}`);
  console.log();
}

// Save report
writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
console.log(`Report saved to ${REPORT_FILE}`);

// Summary
const actions = { REMOVE: 0, KEEP: 0, FIX_DATE: 0, UNKNOWN: 0 };
for (const r of report) actions[r.action] = (actions[r.action] || 0) + 1;
console.log();
console.log("=".repeat(65));
console.log(`  REMOVE: ${actions.REMOVE}  |  KEEP: ${actions.KEEP}  |  FIX_DATE: ${actions.FIX_DATE}  |  UNKNOWN: ${actions.UNKNOWN}`);
console.log("=".repeat(65));

// Apply if requested
if (applyMode) {
  let removed = 0, fixed = 0;
  for (const r of report) {
    if (r.action === "REMOVE") {
      const idx = albums.findIndex((a) => a.id === r.id);
      if (idx >= 0) { albums.splice(idx, 1); removed++; }
    } else if (r.action === "FIX_DATE" && r.suggestedYear) {
      const a = albums.find((a) => a.id === r.id);
      if (a) { a.year = r.suggestedYear; fixed++; }
    }
  }
  writeFileSync(DATA_FILE, JSON.stringify(albums, null, 2));
  console.log(`\nApplied: ${removed} removed, ${fixed} dates fixed. ${albums.length} albums remain.`);
}
