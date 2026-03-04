/**
 * Client-side MusicBrainz search for user-added albums.
 */

import { INSTRUMENTS } from "./data";

const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "TheJazzGraph/0.1.0 (https://github.com/jazz-graph)";

let lastRequest = 0;

async function mbFetch(url) {
  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - lastRequest));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`MusicBrainz: HTTP ${res.status}`);
  return res.json();
}

// Normalize MB instrument names to our canonical forms
const INSTRUMENT_ALIASES = {
  "tenor saxophone": "tenor sax",
  "alto saxophone": "alto sax",
  "soprano saxophone": "soprano sax",
  "baritone saxophone": "baritone sax",
  "double bass": "bass",
  "contrabass": "bass",
  "acoustic bass": "bass",
  "upright bass": "bass",
  "bass guitar": "electric bass",
  "drum set": "drums",
  "drumset": "drums",
  "drum kit": "drums",
  "acoustic guitar": "guitar",
  "rhodes": "electric piano",
  "fender rhodes": "electric piano",
  "synthesizer": "keyboards",
  "keyboard": "keyboards",
  "clavinet": "keyboards",
  "lead vocals": "vocals",
  "background vocals": "vocals",
  "vocal": "vocals",
  "congas": "percussion",
  "bongos": "percussion",
  "timbales": "percussion",
  "pocket trumpet": "trumpet",
};

function normalizeInstrument(raw) {
  const lower = raw.toLowerCase().trim();
  if (INSTRUMENTS[lower]) return lower;
  if (INSTRUMENT_ALIASES[lower]) return INSTRUMENT_ALIASES[lower];
  // Try without trailing "s" or common suffixes
  for (const [alias, canonical] of Object.entries(INSTRUMENT_ALIASES)) {
    if (lower.includes(alias)) return canonical;
  }
  return lower;
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Search MusicBrainz for releases matching title + artist.
 * Returns array of { mbid, title, artist, year, label }.
 */
export async function searchReleases(title, artist) {
  const query = encodeURIComponent(
    `release:"${title}" AND artist:"${artist}"`
  );
  const url = `${MB_BASE}/release?query=${query}&limit=10&fmt=json`;
  const data = await mbFetch(url);

  return (data.releases || []).map((r) => ({
    mbid: r.id,
    title: r.title,
    artist: r["artist-credit"]?.[0]?.name || artist,
    year: parseInt(r.date?.slice(0, 4), 10) || null,
    label: r["label-info"]?.[0]?.label?.name || null,
    score: r.score,
  }));
}

/**
 * Fetch full release details including lineup.
 * Returns an album object ready for the dataset.
 */
export async function fetchReleaseDetails(mbid, creditedArtist) {
  const url = `${MB_BASE}/release/${mbid}?inc=artist-credits+recordings+artist-rels+recording-level-rels+release-groups+labels&fmt=json`;
  const data = await mbFetch(url);

  const title = data.title;
  const artist = creditedArtist || data["artist-credit"]?.[0]?.name || "Unknown";
  const rgid = data["release-group"]?.id || null;
  const label = data["label-info"]?.[0]?.label?.name || null;

  // Year: prefer release-group first-release-date
  let year = null;
  const rgDate = data["release-group"]?.["first-release-date"];
  if (rgDate) year = parseInt(rgDate.slice(0, 4), 10);
  if (!year && data.date) year = parseInt(data.date.slice(0, 4), 10);

  // Extract lineup from artist relations
  const lineup = [];
  const seen = new Set();

  function processRelations(relations) {
    for (const rel of relations || []) {
      if (!["instrument", "vocal", "performer"].includes(rel.type)) continue;
      const name = rel.artist?.name;
      if (!name || seen.has(name)) continue;
      seen.add(name);

      let instrument = "unknown";
      if (rel.attributes?.length) {
        instrument = normalizeInstrument(rel.attributes[0]);
      } else if (rel.type === "vocal") {
        instrument = "vocals";
      }

      lineup.push({
        name,
        instrument,
        lead: name.toLowerCase() === artist.toLowerCase(),
      });
    }
  }

  // Release-level relations
  processRelations(data.relations);

  // Recording-level relations
  for (const media of data.media || []) {
    for (const track of media.tracks || []) {
      processRelations(track.recording?.relations);
    }
  }

  // If no lineup found but we have the artist credit, add them
  if (lineup.length === 0) {
    lineup.push({ name: artist, instrument: "unknown", lead: true });
  }

  // Make sure the credited artist is marked as lead
  const hasLead = lineup.some((m) => m.lead);
  if (!hasLead && lineup.length > 0) {
    const match = lineup.find(
      (m) => m.name.toLowerCase() === artist.toLowerCase()
    );
    if (match) match.lead = true;
  }

  return {
    id: slugify(`${artist}-${title}`),
    title,
    artist,
    year,
    label,
    coverPath: null,
    mbid,
    rgid,
    lineup,
    userAdded: true,
  };
}
