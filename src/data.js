/**
 * Data layer — loads and indexes the pre-fetched album dataset.
 */

// Instrument → family/color mapping
const INSTRUMENTS = {
  trumpet:       { family: "brass",   color: "#e85d3a" },
  cornet:        { family: "brass",   color: "#d94e2e" },
  trombone:      { family: "brass",   color: "#c44425" },
  flugelhorn:    { family: "brass",   color: "#cf5633" },
  "french horn": { family: "brass",   color: "#b84020" },
  "tenor sax":   { family: "reeds",   color: "#d4a843" },
  "alto sax":    { family: "reeds",   color: "#c99b38" },
  "soprano sax": { family: "reeds",   color: "#be8e2d" },
  "baritone sax":{ family: "reeds",   color: "#b38122" },
  "bass clarinet":{ family: "reeds",  color: "#a87417" },
  clarinet:      { family: "reeds",   color: "#9d670c" },
  flute:         { family: "reeds",   color: "#c4a050" },
  piano:         { family: "keys",    color: "#5b9bd5" },
  "electric piano":{ family: "keys",  color: "#4a8ac4" },
  keyboards:     { family: "keys",    color: "#3979b3" },
  organ:         { family: "keys",    color: "#2868a2" },
  bass:          { family: "rhythm",  color: "#7c5cbf" },
  "electric bass":{ family: "rhythm", color: "#6b4bae" },
  drums:         { family: "rhythm",  color: "#45a67d" },
  percussion:    { family: "rhythm",  color: "#389068" },
  guitar:        { family: "strings", color: "#c75d8f" },
  "electric guitar":{ family: "strings", color: "#b64c7e" },
  vibraphone:    { family: "mallets", color: "#6bb5a0" },
  marimba:       { family: "mallets", color: "#5aa48f" },
  vocals:        { family: "vocals",  color: "#d48db0" },
  // Extended instruments from full dataset
  tuba:          { family: "brass",   color: "#a33a1c" },
  euphonium:     { family: "brass",   color: "#b84428" },
  oboe:          { family: "reeds",   color: "#b49040" },
  bassoon:       { family: "reeds",   color: "#9a7a20" },
  contrabassoon: { family: "reeds",   color: "#8a6a10" },
  harmonica:     { family: "reeds",   color: "#d4b060" },
  violin:        { family: "strings", color: "#b0507a" },
  viola:         { family: "strings", color: "#a04570" },
  cello:         { family: "strings", color: "#903a66" },
  harp:          { family: "strings", color: "#d070a0" },
  xylophone:     { family: "mallets", color: "#4a947e" },
};

const LABELS = {
  "Blue Note":   "#0070c0",
  Columbia:      "#c41e3a",
  "Impulse!":    "#e8740c",
  Prestige:      "#6b3fa0",
  Riverside:     "#2d8659",
  Atlantic:      "#cc9b26",
  ECM:           "#5a7d8c",
  Verve:         "#b38600",
  EmArcy:        "#8b5e3c",
  "Warner Bros.":"#3d6b4f",
  Mercury:       "#7a4466",
  // Secondary labels (smaller representation)
  Contemporary:  "#8a6e45",
  "RCA Victor":  "#b5343c",
  Capitol:       "#9b4d6e",
  "ESP-Disk'":   "#7a8a5c",
  Polydor:       "#c47830",
  "United Artists":"#6a7a9a",
  Debut:         "#5e8a6e",
  Vogue:         "#9a6080",
  "A&M":         "#7a6a9a",
  Fantasy:       "#5a8a7a",
  Candid:        "#8a5a5a",
  "Pacific Jazz": "#5a7a8a",
};

export function instrumentColor(inst) {
  return INSTRUMENTS[inst]?.color || "#888";
}

export function instrumentFamily(inst) {
  return INSTRUMENTS[inst]?.family || "other";
}

export function labelColor(label) {
  return LABELS[label] || "#888";
}

export function slugify(str) {
  return str
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Build derived data structures from the album list.
 */
export function buildIndex(albums) {
  // Build musician index
  const musicianMap = new Map();

  for (const album of albums) {
    for (const m of album.lineup) {
      if (!musicianMap.has(m.name)) {
        musicianMap.set(m.name, {
          name: m.name,
          slug: slugify(m.name),
          instruments: new Set(),
          albums: [],
          leadAlbums: [],
        });
      }
      const entry = musicianMap.get(m.name);
      entry.instruments.add(m.instrument);
      entry.albums.push({ ...album, _inst: m.instrument, _lead: m.lead });
      if (m.lead) entry.leadAlbums.push(album);
    }
  }

  const musicians = [...musicianMap.values()]
    .map((m) => ({
      ...m,
      instruments: [...m.instruments],
      primary: [...m.instruments][0],
    }))
    .sort((a, b) => b.albums.length - a.albums.length);

  // Build album slug map
  const albumsBySlug = new Map();
  for (const a of albums) {
    albumsBySlug.set(a.id, a);
  }

  // Build artist slug map
  const artistsBySlug = new Map();
  for (const m of musicians) {
    artistsBySlug.set(m.slug, m);
  }

  return { musicians, albumsBySlug, artistsBySlug };
}

export { INSTRUMENTS, LABELS };
