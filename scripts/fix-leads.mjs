#!/usr/bin/env node

/**
 * Fix lead musician instrument assignments.
 *
 * When the credited artist is a group name (e.g. "Bill Evans Trio",
 * "Weather Report"), the pipeline sets lead=true but instrument="unknown"
 * because it can't match the group name to a lineup entry.
 *
 * This script:
 * 1. Maps known group names to their leader
 * 2. Finds that leader in the lineup and copies their instrument
 * 3. Replaces the group-name lead entry with the actual musician
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "..", "data", "albums.json");

// Map group/credited artist names to the actual leader's name
const GROUP_TO_LEADER = {
  "bill evans trio": "Bill Evans",
  "miles davis quintet": "Miles Davis",
  "miles davis sextet": "Miles Davis",
  "weather report": "Wayne Shorter",  // co-led by Shorter & Zawinul
  "clifford brown & max roach": "Clifford Brown",
  "clifford brown and max roach": "Clifford Brown",
  "dave holland quartet": "Dave Holland",
  "dave holland quintet": "Dave Holland",
  "john coltrane quartet": "John Coltrane",
  "duke ellington & his orchestra": "Duke Ellington",
  "duke ellington and his orchestra": "Duke Ellington",
  "the oscar peterson trio": "Oscar Peterson",
  "oscar peterson trio": "Oscar Peterson",
  "ahmad jamal trio": "Ahmad Jamal",
  "the cannonball adderley quintet": "Cannonball Adderley",
  "cannonball adderley quintet": "Cannonball Adderley",
  "wynton kelly trio": "Wynton Kelly",
  "pat metheny group": "Pat Metheny",
  "mahavishnu orchestra": "John McLaughlin",
  "return to forever": "Chick Corea",
  "the ornette coleman trio": "Ornette Coleman",
  "the ornette coleman quartet": "Ornette Coleman",
  "ornette coleman trio": "Ornette Coleman",
  "ornette coleman quartet": "Ornette Coleman",
  "albert ayler trio": "Albert Ayler",
  "albert ayler quartet": "Albert Ayler",
  "the art blakey quintet": "Art Blakey",
  "art blakey and the jazz messengers": "Art Blakey",
  "art blakey & the jazz messengers": "Art Blakey",
  "the jazz messengers": "Art Blakey",
  "the horace silver quintet": "Horace Silver",
  "horace silver quintet": "Horace Silver",
  "modern jazz quartet": "Milt Jackson",
  "the modern jazz quartet": "Milt Jackson",
  "keith jarrett, gary peacock, jack dejohnette": "Keith Jarrett",
  "keith jarrett trio": "Keith Jarrett",
  "the thelonious monk quartet": "Thelonious Monk",
  "thelonious monk quartet": "Thelonious Monk",
  "the dave brubeck quartet": "Dave Brubeck",
  "dave brubeck quartet": "Dave Brubeck",
  "the charles mingus jazz workshop": "Charles Mingus",
  "charles mingus and his jazz workshop": "Charles Mingus",
  "the jazztet": "Art Farmer",
  "jaco pastorius big band": "Jaco Pastorius",
};

// Known primary instruments for leaders (fallback if not in lineup)
const KNOWN_INSTRUMENTS = {
  "Art Blakey": "drums",
  "Bill Evans": "piano",
  "Miles Davis": "trumpet",
  "Wayne Shorter": "tenor sax",
  "Clifford Brown": "trumpet",
  "Dave Holland": "bass",
  "John Coltrane": "tenor sax",
  "Duke Ellington": "piano",
  "Oscar Peterson": "piano",
  "Ahmad Jamal": "piano",
  "Cannonball Adderley": "alto sax",
  "Wynton Kelly": "piano",
  "Pat Metheny": "guitar",
  "John McLaughlin": "guitar",
  "Chick Corea": "piano",
  "Ornette Coleman": "alto sax",
  "Albert Ayler": "tenor sax",
  "Horace Silver": "piano",
  "Milt Jackson": "vibraphone",
  "Keith Jarrett": "piano",
  "Thelonious Monk": "piano",
  "Dave Brubeck": "piano",
  "Charles Mingus": "bass",
  "Art Farmer": "trumpet",
  "Jaco Pastorius": "bass",
  "Ella Fitzgerald": "vocals",
  "Billie Holiday": "vocals",
  "Sarah Vaughan": "vocals",
  "Freddie Hubbard": "trumpet",
  "Lee Morgan": "trumpet",
  "Woody Shaw": "trumpet",
  "Kenny Dorham": "trumpet",
  "Dizzy Gillespie": "trumpet",
  "Chet Baker": "trumpet",
  "Wynton Marsalis": "trumpet",
  "Dexter Gordon": "tenor sax",
  "Stan Getz": "tenor sax",
  "Sonny Rollins": "tenor sax",
  "Joe Henderson": "tenor sax",
  "Hank Mobley": "tenor sax",
  "Charlie Parker": "alto sax",
  "Eric Dolphy": "alto sax",
  "Jackie McLean": "alto sax",
  "Sonny Clark": "piano",
  "Herbie Hancock": "piano",
  "McCoy Tyner": "piano",
  "Bud Powell": "piano",
  "Andrew Hill": "piano",
  "Wes Montgomery": "guitar",
  "Grant Green": "guitar",
  "Jim Hall": "guitar",
  "Ron Carter": "bass",
  "Max Roach": "drums",
  "Tony Williams": "drums",
  "Elvin Jones": "drums",
  "Roy Haynes": "drums",
  "Bobby Hutcherson": "vibraphone",
  "Sun Ra": "piano",
  "Cecil Taylor": "piano",
  "Charles Lloyd": "tenor sax",
  "Pharoah Sanders": "tenor sax",
  "Archie Shepp": "tenor sax",
  "Billy Cobham": "drums",
  "Pete La Roca": "drums",
};

const albums = JSON.parse(readFileSync(DATA_FILE, "utf8"));
let fixed = 0;

for (const album of albums) {
  const lead = album.lineup.find(m => m.lead);
  if (!lead || lead.instrument !== "unknown") continue;

  const artistLower = album.artist.toLowerCase();

  // Try to resolve group name to leader
  let leaderName = GROUP_TO_LEADER[artistLower];

  // If not a known group, try matching artist name directly in lineup
  if (!leaderName) {
    // Try exact match first
    const match = album.lineup.find(m => !m.lead && m.instrument !== "unknown" &&
      artistLower.includes(m.name.toLowerCase()));
    if (match) {
      leaderName = match.name;
    }
  }

  if (leaderName) {
    // Find this person in the lineup
    const inLineup = album.lineup.find(m => m.name === leaderName && m.instrument !== "unknown");

    if (inLineup) {
      // Update the lead entry
      lead.name = leaderName;
      lead.instrument = inLineup.instrument;
      console.log(`✓ ${album.artist} — ${album.title}: ${leaderName} (${inLineup.instrument})`);
      fixed++;
    } else if (KNOWN_INSTRUMENTS[leaderName]) {
      // Leader not in lineup with instrument, use known instrument
      lead.name = leaderName;
      lead.instrument = KNOWN_INSTRUMENTS[leaderName];
      console.log(`✓ ${album.artist} — ${album.title}: ${leaderName} (${lead.instrument}) [from known]`);
      fixed++;
    } else {
      console.log(`✗ ${album.artist} — ${album.title}: found ${leaderName} but no instrument`);
    }
  } else {
    // Try known instruments for the artist name directly
    const inst = KNOWN_INSTRUMENTS[album.artist];
    if (inst) {
      lead.instrument = inst;
      console.log(`✓ ${album.artist} — ${album.title}: ${album.artist} (${inst}) [from known]`);
      fixed++;
    } else {
      console.log(`✗ ${album.artist} — ${album.title}: could not resolve`);
    }
  }
}

writeFileSync(DATA_FILE, JSON.stringify(albums, null, 2));

// Check remaining unknowns
const remaining = albums.filter(a => {
  const lead = a.lineup.find(m => m.lead);
  return lead && lead.instrument === "unknown";
});

console.log(`\nDone: ${fixed} fixed, ${remaining.length} still unknown`);
if (remaining.length) {
  console.log("\nStill unknown:");
  remaining.forEach(a => {
    const lead = a.lineup.find(m => m.lead);
    console.log(`  ${a.artist} — ${a.title} (lead: ${lead.name})`);
  });
}
