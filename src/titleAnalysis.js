/**
 * Title analysis — extract semantic patterns from album and track titles.
 */

// ─── Geography ───────────────────────────────────────────────────────

export const PLACES = {
  // Cities
  "new york": { lat: 40.71, lng: -74.01, label: "New York" },
  "manhattan": { lat: 40.78, lng: -73.97, label: "New York" },
  "harlem": { lat: 40.81, lng: -73.95, label: "Harlem" },
  "brooklyn": { lat: 40.65, lng: -73.95, label: "Brooklyn" },
  "broadway": { lat: 40.76, lng: -73.98, label: "Broadway" },
  "52nd street": { lat: 40.76, lng: -73.98, label: "52nd Street" },
  "paris": { lat: 48.86, lng: 2.35, label: "Paris" },
  "london": { lat: 51.51, lng: -0.13, label: "London" },
  "tokyo": { lat: 35.68, lng: 139.69, label: "Tokyo" },
  "havana": { lat: 23.11, lng: -82.37, label: "Havana" },
  "berlin": { lat: 52.52, lng: 13.41, label: "Berlin" },
  "vienna": { lat: 48.21, lng: 16.37, label: "Vienna" },
  "stockholm": { lat: 59.33, lng: 18.07, label: "Stockholm" },
  "copenhagen": { lat: 55.68, lng: 12.57, label: "Copenhagen" },
  "chicago": { lat: 41.88, lng: -87.63, label: "Chicago" },
  "san francisco": { lat: 37.77, lng: -122.42, label: "San Francisco" },
  "los angeles": { lat: 34.05, lng: -118.24, label: "Los Angeles" },
  "l.a.": { lat: 34.05, lng: -118.24, label: "Los Angeles" },
  "detroit": { lat: 42.33, lng: -83.05, label: "Detroit" },
  "new orleans": { lat: 29.95, lng: -90.07, label: "New Orleans" },
  "memphis": { lat: 35.15, lng: -90.05, label: "Memphis" },
  "st. louis": { lat: 38.63, lng: -90.2, label: "St. Louis" },
  "philadelphia": { lat: 39.95, lng: -75.17, label: "Philadelphia" },
  "boston": { lat: 42.36, lng: -71.06, label: "Boston" },
  "amsterdam": { lat: 52.37, lng: 4.9, label: "Amsterdam" },
  "rio": { lat: -22.91, lng: -43.17, label: "Rio de Janeiro" },
  "montreal": { lat: 45.5, lng: -73.57, label: "Montreal" },
  "montreux": { lat: 46.43, lng: 6.91, label: "Montreux" },
  "newport": { lat: 41.49, lng: -71.31, label: "Newport" },
  "village": { lat: 40.73, lng: -74.0, label: "Village" },
  // Regions / Countries
  "africa": { lat: 0, lng: 20, label: "Africa" },
  "african": { lat: 0, lng: 20, label: "Africa" },
  "spain": { lat: 40.42, lng: -3.7, label: "Spain" },
  "spanish": { lat: 40.42, lng: -3.7, label: "Spain" },
  "brazil": { lat: -15.78, lng: -47.93, label: "Brazil" },
  "brazilian": { lat: -15.78, lng: -47.93, label: "Brazil" },
  "cuba": { lat: 23.11, lng: -82.37, label: "Cuba" },
  "cuban": { lat: 23.11, lng: -82.37, label: "Cuba" },
  "india": { lat: 20.59, lng: 78.96, label: "India" },
  "indian": { lat: 20.59, lng: 78.96, label: "India" },
  "japan": { lat: 36.2, lng: 138.25, label: "Japan" },
  "japanese": { lat: 36.2, lng: 138.25, label: "Japan" },
  "caribbean": { lat: 15, lng: -75, label: "Caribbean" },
  "latin": { lat: 19.43, lng: -99.13, label: "Latin America" },
  "mississippi": { lat: 32.35, lng: -89.4, label: "Mississippi" },
  "atlantic": { lat: 30, lng: -40, label: "Atlantic" },
  "pacific": { lat: 0, lng: -150, label: "Pacific" },
  "east": { lat: null, lng: null, label: "East" }, // skip generic
  "west": { lat: null, lng: null, label: "West" },
};

// ─── Mood / Emotion ──────────────────────────────────────────────────

export const MOOD_CATEGORIES = {
  joy: ["joy", "happy", "jubilee", "jubilant", "celebration", "smile", "laughing", "delight", "ecstasy", "rejoice", "fun", "playful", "sunny", "bright"],
  love: ["love", "lover", "loving", "romance", "romantic", "kiss", "embrace", "tender", "gentle", "dear", "darling", "sweetheart", "heart", "passion", "desire", "affection"],
  melancholy: ["blue", "blues", "sad", "sadness", "sorrow", "lonely", "lonesome", "melancholy", "tears", "cry", "crying", "weep", "lament", "mourn", "grief", "heartbreak"],
  longing: ["longing", "yearning", "miss", "missing", "nostalgia", "remember", "memory", "memories", "yesterday", "wish", "dream", "dreaming", "someday", "waiting"],
  peace: ["peace", "peaceful", "calm", "quiet", "still", "silence", "serene", "gentle", "soft", "rest", "sleep", "slumber", "lullaby", "meditation", "tranquil"],
  freedom: ["free", "freedom", "fly", "flying", "flight", "soar", "liberation", "spirit", "spiritual", "soul", "wild", "open", "space", "infinite"],
  night: ["night", "midnight", "nocturne", "moonlight", "moon", "dark", "darkness", "shadow", "twilight", "dusk", "evening", "star", "stars", "starlight"],
  fire: ["fire", "flame", "burning", "hot", "heat", "blaze", "smoke", "smoking", "cookin", "sizzle", "fever"],
};

// ─── Musical Vocabulary ──────────────────────────────────────────────

export const MUSIC_VOCABULARY = {
  forms: ["blues", "ballad", "bossa", "waltz", "swing", "bebop", "bop", "samba", "mambo", "calypso", "tango", "bolero", "rondo", "fugue", "sonata", "suite", "prelude", "etude", "improvisation", "jam"],
  slang: ["cookin", "groovin", "blowin", "diggin", "jivin", "stompin", "swingin", "rollin", "walkin", "workin", "steamin", "relaxin", "cruisin", "movin", "gettin"],
  structure: ["solo", "duo", "trio", "quartet", "quintet", "sextet", "septet", "octet", "session", "jam", "live", "concert", "recital"],
};

// ─── Time & Nature Imagery ───────────────────────────────────────────

export const IMAGERY_CATEGORIES = {
  "time-of-day": ["morning", "dawn", "sunrise", "noon", "afternoon", "evening", "sunset", "dusk", "twilight", "night", "midnight"],
  seasons: ["spring", "summer", "autumn", "fall", "winter"],
  weather: ["rain", "rainy", "storm", "stormy", "thunder", "lightning", "wind", "windy", "cloud", "clouds", "cloudy", "snow", "fog", "mist", "sunshine", "sunny"],
  celestial: ["sun", "moon", "star", "stars", "sky", "heaven", "constellation", "eclipse", "aurora", "cosmic"],
  nature: ["river", "ocean", "sea", "mountain", "forest", "garden", "flower", "rose", "tree", "leaf", "leaves", "bird", "rain", "water", "wave", "island"],
};

// ─── Extraction ──────────────────────────────────────────────────────

/**
 * Get all titles (album + track) from an album list.
 */
export function getAllTitles(albums) {
  const titles = [];
  for (const a of albums) {
    titles.push(a.title);
    for (const t of a.tracks || []) {
      titles.push(t.title);
    }
  }
  return titles;
}

/**
 * Count keyword matches in titles.
 * Returns { category: { word: count } }
 */
export function countKeywords(titles, categories) {
  const results = {};
  for (const [cat, words] of Object.entries(categories)) {
    results[cat] = {};
    for (const word of words) {
      const regex = new RegExp(`\\b${word}\\b`, "i");
      let count = 0;
      for (const t of titles) {
        if (regex.test(t)) count++;
      }
      if (count > 0) results[cat][word] = count;
    }
  }
  return results;
}

/**
 * Extract place mentions from titles.
 * Returns [{ label, lat, lng, count }]
 */
// Artistic phrases where "in [place]" is NOT a venue reference
const ARTISTIC_IN = /\b(?:april|autumn|night|midnight|round midnight|spring|summer|winter|sketches of)\s+in\b/i;

function isVenueReference(title, placeKey) {
  const t = title.toLowerCase();
  const k = placeKey.toLowerCase();

  // "live/recorded/concert at/in/from [place]"
  if (/\b(?:live|recorded|concert)\s+(?:at|in|from)\b/.test(t)) return true;
  // "at [the] [0-3 words] [place]" — direct venue
  if (new RegExp(`\\bat\\s+(?:the\\s+)?(?:\\w+\\s+){0,3}${k}\\b`).test(t)) return true;
  // "in [place]" unless preceded by artistic phrase
  if (new RegExp(`\\bin\\s+${k}\\b`).test(t) && !ARTISTIC_IN.test(t)) return true;
  // "from [place]"
  if (new RegExp(`\\bfrom\\s+${k}\\b`).test(t)) return true;
  // "[place] + year/decade" (e.g., "Montreux '77", "Paris 1965")
  if (new RegExp(`${k}\\s*['''\u2019]?\\d{2,4}\\b`).test(t)) return true;
  // "[place] + roman numerals" (e.g., "Montreux II")
  if (new RegExp(`${k}\\s+[ivx]+\\b`).test(t)) return true;
  // "[place] [0-2 words] Concert/Festival/Sessions/Tapes etc."
  if (new RegExp(`${k}\\s+(?:\\w+\\s+){0,2}(?:concert|festival|session|tapes|years|jam|live)s?\\b`).test(t)) return true;
  // Specific venue names
  if (/\bvillage\s+(?:vanguard|gate)\b/.test(t)) return true;
  // "[place] in [other place]" — touring/festival reference
  if (new RegExp(`\\b${k}\\s+in\\s+`).test(t)) return true;

  return false;
}

export function extractPlaces(titles) {
  const counts = new Map();
  for (const [key, place] of Object.entries(PLACES)) {
    if (!place.lat) continue; // skip generic directions
    const regex = new RegExp(`\\b${key}\\b`, "i");
    for (const t of titles) {
      if (!regex.test(t)) continue;
      if (isVenueReference(t, key)) continue;
      const existing = counts.get(place.label);
      if (existing) {
        existing.count += 1;
        existing.matchedTitles.push(t);
      } else {
        counts.set(place.label, { ...place, count: 1, matchedTitles: [t] });
      }
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

/**
 * Given albums and a list of matched title strings, return the albums
 * that contain any of those titles (as album title or track title).
 */
export function albumsForTitles(albums, matchedTitles) {
  const titleSet = new Set(matchedTitles);
  const result = [];
  const seen = new Set();
  for (const a of albums) {
    if (seen.has(a.id)) continue;
    if (titleSet.has(a.title)) {
      result.push(a);
      seen.add(a.id);
      continue;
    }
    for (const t of a.tracks || []) {
      if (titleSet.has(t.title)) {
        result.push(a);
        seen.add(a.id);
        break;
      }
    }
  }
  return result.sort((a, b) => (a.year || 0) - (b.year || 0));
}
