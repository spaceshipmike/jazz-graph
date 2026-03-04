```yaml
title: The Jazz Graph
spec-version: "0.2"
spec-format: nlspec-v2
date: 2026-03-04
status: active
author: mike
synopsis:
  short: "Interactive visual encyclopedia exploring connections across 700+ classic jazz albums — browse, visualize, and contribute"
  medium: "The Jazz Graph is a static web app that visualizes the hidden network of jazz — how musicians, albums, instruments, labels, and eras connect across 320+ canonical recordings. Built with real cover art and multiple purpose-built data visualizations in a Blue Note-inspired dark aesthetic."
  readme: "The Jazz Graph is an interactive encyclopedia of jazz, built for discovery. Starting from a curated collection of 320+ greatest jazz albums (sourced from MusicBrainz and Discogs), it reveals the dense web of connections between musicians, albums, instruments, and labels through multiple visualization types — a browsable gallery, force-directed network graph, artist career timelines, and album connection diagrams. Every view is crafted in a dark, typographically bold aesthetic inspired by Reid Miles' iconic Blue Note Records covers. No backend required — all data is pre-fetched and bundled for fast, self-contained deployment."
  stack:
    - JavaScript
    - React + Vite
    - D3.js
    - MusicBrainz API
    - Discogs API
    - Static site deployment
  patterns:
    - Static SPA with pre-built data
    - Build-time data pipeline
    - Client-side routing
    - Multiple specialized data visualizations
    - Design token system
  goals:
    - Visualize jazz musician/album connections through diverse, polished dataviz
    - Provide a browsable encyclopedia experience with real album art and artist photos
    - Maintain Blue Note-inspired visual identity across all views
    - Perform fluidly with 320+ albums on commodity hardware
    - Ship incrementally in 1-2 hour daily sessions
plugin-version: 0.28.0
```

# The Jazz Graph

## 1. Experience Vision

The Jazz Graph is a visual encyclopedia of jazz. It makes visible what liner notes only hint at — the dense, fascinating web of who played with whom, when, and on what instrument.

The experience is **discovery-driven**. You land on a gallery of real album covers. You click one. You see the lineup. You notice Ron Carter. You click his name. You see his timeline — 15 albums across two decades, moving from hard bop to fusion. You notice he overlaps with Herbie Hancock on 6 records. You pull up the network graph and see the cluster they form with Tony Williams and Wayne Shorter — the Second Great Quintet plus solo work radiating outward.

Every view answers a different question about the data. The gallery asks "what's here?" The network asks "who connects to whom?" The timeline asks "what's this person's story?" The connections view asks "which albums share DNA?"

### Design Language

Dark, high-contrast, typographically bold — inspired by Reid Miles' Blue Note Records covers from the 1950s-60s. This isn't a generic dashboard. It's a love letter to jazz presented through data.

- **Typography:** Bold serif for headings (display weight), monospace for metadata and data labels
- **Color:** Instrument-family color system (brass = warm orange/red, reeds = gold, keys = blue, rhythm = purple/green, strings = pink, mallets = teal). Label colors as accents.
- **Texture:** Subtle film grain overlay. Deep blacks. Restrained use of glow on interactive elements.
- **Layout:** Each view is its own distinct dataviz format, not a repurposed generic chart. Inspired by the diversity of types at datavizproject.com.

## 2. Data

### Source & Pipeline

A build-time script fetches and assembles the dataset:

1. **Album list:** Composite of canonical "greatest jazz albums" lists (Rolling Stone, Jazz Times, AllAboutJazz, etc.), targeting ~500 albums
2. **Metadata:** MusicBrainz for album/artist/personnel data (full session lineups with instruments)
3. **Cover art:** Cover Art Archive (primary), Discogs API (fallback)
4. **Artist photos:** Discogs artist images (Spotify as future enhancement)
5. **Output:** Static JSON + downloaded image assets

### Data Schema

```
Album {
  id: string (slugified artist-title)
  title: string
  artist: string (bandleader / credited artist)
  year: number (original release year)
  label: string
  coverPath: string | null (local image path)
  mbid: string (MusicBrainz release ID — pipeline provenance)
  rgid: string (MusicBrainz release-group ID — pipeline provenance)
  lineup: Musician[]
}

Musician {
  name: string (normalized across albums)
  instrument: string
  lead: boolean
}

Artist (derived at runtime) {
  name: string
  slug: string
  instruments: string[]
  primary: string (first instrument)
  albums: Album[] (all appearances)
  leadAlbums: Album[] (as leader only)
}
```

### Instrument Taxonomy

Instruments are grouped into families for color coding:
- **Brass:** trumpet, cornet, trombone, flugelhorn, french horn, tuba, euphonium
- **Reeds:** tenor sax, alto sax, soprano sax, baritone sax, bass clarinet, clarinet, flute, oboe, bassoon, contrabassoon, harmonica
- **Keys:** piano, electric piano, keyboards, organ
- **Rhythm:** bass, electric bass, drums, percussion
- **Strings:** guitar, electric guitar, violin, viola, cello, harp
- **Mallets:** vibraphone, marimba, xylophone
- **Vocals:** vocals

Instruments not in the map fall through to a neutral gray (#888) and "other" family.

### Label Colors

Record labels have assigned brand colors used throughout the app for node coloring, metadata display, and group headers.

**Primary labels (11):** Blue Note (#0070c0), Columbia (#c41e3a), Impulse! (#e8740c), Prestige (#6b3fa0), Riverside (#2d8659), Atlantic (#cc9b26), ECM (#5a7d8c), Verve (#b38600), EmArcy (#8b5e3c), Warner Bros. (#3d6b4f), Mercury (#7a4466).

**Secondary labels (12):** Contemporary (#8a6e45), RCA Victor (#b5343c), Capitol (#9b4d6e), ESP-Disk' (#7a8a5c), Polydor (#c47830), United Artists (#6a7a9a), Debut (#5e8a6e), Vogue (#9a6080), A&M (#7a6a9a), Fantasy (#5a8a7a), Candid (#8a5a5a), Pacific Jazz (#5a7a8a).

Unrecognized labels use neutral gray (#888).

## 3. Views

### 3.1 Album Gallery (Home — `/`)

The primary entry point. A filterable, groupable grid of album cards with real cover art.

**Card contents:** Cover image, title, artist, year, label badge, truncated lineup pills.

**Controls:**
- Search: filters across title, artist, musician name, instrument, label
- Group by: label, decade, leader, lead instrument
- Instrument filter: toggle pills to show only albums featuring that instrument

**Behavior:** Groups display as labeled sections with a colored divider. Filtering is immediate. Cards animate in with staggered fade.

### 3.2 Network Graph (`/network`)

Force-directed graph showing musician-album connections.

**Nodes:** Albums (colored by label) and musicians (colored by primary instrument). Node size reflects number of connections.

**Edges:** Connect musicians to albums they appear on. Colored by instrument when filtered.

**Interaction:** Zoom, pan, drag nodes. Hover highlights connections and dims unrelated nodes. Click navigates to full album/artist page. Instrument legend is interactive (click to filter).

**Performance target:** 60fps interaction with full dataset. Initial layout settles without visible jank.

### 3.3 Artist Timeline (`/artist/:slug`)

A dedicated full page for each artist.

**Header:** Artist name, photo (if available), instrument badges, album count, leader count.

**Timeline:** Horizontal, year-axis. Each album is a node on the line. Leader appearances are visually prominent (larger, brighter). Sideman appearances are subdued. Hovering a node shows album details.

**Collaborators:** Section showing top collaborators ranked by shared-album count, with links to their pages.

**Discography:** Grid of album covers (all appearances), sortable by year.

### 3.4 Album Detail (`/album/:slug`)

A dedicated full page for each album.

**Header:** Large cover art, title, artist, year, label.

**Lineup:** Full list of musicians with instrument and lead status. Each name links to the artist page.

**Connections:** Section showing other albums that share musicians with this one, ranked by number of shared personnel.

### 3.5 Album Connections (`/connections`)

Two distinct visualizations showing how albums are related through shared musicians, toggled via Chord / Arc buttons.

**Chord Diagram** (default): Albums arranged around a circle, grouped by label. Ribbons connect albums that share musicians — ribbon thickness maps to number of shared personnel. Label colors are used throughout. Hovering an arc shows album info; hovering a ribbon shows which musicians are shared. Click navigates to album detail.

**Arc Diagram**: Albums laid out on a horizontal axis sorted by year. Arcs above the axis connect albums sharing musicians — arc thickness and opacity map to shared count. Year axis provides temporal context. Same hover/click behavior as chord view.

**Filtering:** Minimum shared musicians threshold (1–5) to control density. Both views share the same filter.

### 3.6 Instrument Eras (`/eras`)

Streamgraph showing how instrument family prevalence evolves across the jazz timeline (1949–2005). Albums are grouped by year, and instrument families (brass, reeds, keys, rhythm, strings, mallets, vocals) are counted per year. D3 stack with `stackOffsetWiggle` and `curveBasis` produces smooth, organic streams. Each stream is colored by its instrument family token. Hovering a stream highlights it and shows a tooltip with family name, year, and album count. Clicking a stream navigates to the gallery filtered by a representative instrument from that family.

### 3.7 Label Flow (`/flow`)

Alluvial diagram showing how musicians moved between record labels across 7 time periods (1949–55, 1956–60, 1961–65, 1966–70, 1971–75, 1976–80, 1981+). Columns represent periods; nodes within each column represent labels sized by musician-appearance count. Curved ribbons connect labels across consecutive periods when musicians recorded for one label in one period and another in the next. Node colors use `labelColor()`. Hovering a node shows label name, count, and top musicians. Hovering a ribbon shows source/destination labels and the musicians who made that transition.

### 3.8 Add Album (`#add-album`)

User-contributed album additions via client-side MusicBrainz lookup.

**Entry point:** "Add Album" button in the Gallery header, next to search/filter controls. Styled consistently with nav pills (mono font, pill shape, ghost border).

**Flow:**
1. User clicks "Add Album" → inline form expands (not a separate page or modal)
2. User types album title and artist name
3. User clicks "Search" → app queries MusicBrainz API client-side (`/ws/2/release?query=...&fmt=json`)
4. Results list shows matching releases (title, artist, year, label) — max 10 results
5. User picks the correct release → app fetches full release details (lineup with instruments, release-group for original year)
6. Preview shows: title, artist, year, label, full lineup with instruments and lead status
7. User confirms → album is added to the local dataset

**Instrument normalization:** The same `INSTRUMENTS` map from `data.js` is applied to MusicBrainz instrument strings (e.g., "tenor saxophone" → "tenor sax", "drum set" → "drums") to ensure color coding and family grouping work correctly.

**Persistence:** User-added albums are stored in `localStorage` under a `jazzgraph-user-albums` key as a JSON array. On app load, user albums are merged with the canonical dataset before `buildIndex()` runs. User albums include a `userAdded: true` flag.

**Visual indicator:** User-added album cards show a subtle badge or border treatment (e.g., dashed border or small "+" icon) to distinguish them from the canonical set.

**Removal:** User can remove their additions via a "Remove" action on the album detail page (only shown for `userAdded` albums).

**Integration with all views:** User-added albums participate in all visualizations — gallery, network, connections, eras, flow — exactly like canonical albums. The `buildIndex()` function processes them identically.

**Submit to project:** On the album detail page for user-added albums, a "Submit to project" link opens a pre-filled GitHub Issue in the project repo. The issue body contains the album's title, artist, MusicBrainz release ID, year, and label in a structured format. This lets the maintainer review and add it to the canonical seed list.

**Error handling:** If MusicBrainz is unreachable or returns no results, show a clear message. Rate limit client requests to 1/second per MusicBrainz policy.

## 4. Navigation & Routing

Client-side routing with these routes:
- `/` — Album Gallery
- `/network` — Network Graph
- `/connections` — Album Connections
- `/eras` — Instrument Eras
- `/flow` — Label Flow
- `/album/:slug` — Album Detail
- `/artist/:slug` — Artist Detail

**Navigation bar:** Top nav with view links (Gallery, Network, Connections, Eras, Flow). Active view indicated. App title "The Jazz Graph" links home. On detail pages (`/album/:slug`, `/artist/:slug`), view links are hidden — the title remains as a home link, and a "← Back" link provides navigation context.

**Behavior:**
- Browser back/forward works correctly
- All routes are bookmarkable and load directly
- Filter/search state preserved when returning to gallery via back button
- Clicking any musician name anywhere navigates to their artist page
- Clicking any album reference anywhere navigates to its album page

## 5. Design Tokens

```
Colors:
  bg:           #08080a
  surface:      #111114
  border:       #1e1e22
  fg:           #e8e4dc
  fg-dim:       #888
  fg-muted:     #555
  fg-ghost:     #333

  brass:        #e85d3a
  reeds:        #d4a843
  keys:         #5b9bd5
  rhythm-bass:  #7c5cbf
  rhythm-drums: #45a67d
  strings:      #c75d8f
  mallets:      #6bb5a0
  vocals:       #d48db0

Typography:
  heading:      Bold serif (Playfair Display or similar), 700-900 weight
  body:         System serif stack
  mono:         JetBrains Mono or similar, for metadata/labels/data

Spacing:
  page-padding: 32px
  card-gap:     16px
  section-gap:  48px

Transitions:
  default:      200ms ease
  card-hover:   300ms cubic-bezier(0.2, 0, 0, 1)
  stagger:      40ms per item
```

## 6. Build Order

Each phase targets a shippable increment within 1-2 hour sessions:

1. **Data pipeline** — Script fetching ~500 albums from MusicBrainz/Discogs with cover art
2. **Project scaffold** — Framework setup, routing, design token system, layout shell
3. **Album gallery** — Real covers, filtering, grouping (replaces mockup)
4. **Album detail pages** — Full page with lineup, connections section
5. **Artist detail pages** — Timeline visualization, discography, collaborators
6. **Network graph** — Polished force-directed graph with navigation integration
7. **Album connections** — Force-directed album similarity network
8. **Polish** — Performance optimization, responsive tweaks, animation refinement

## 7. Future Enhancements (Not in v1)

- Spotify artist imagery integration
- Streamgraph of instrument prevalence over time
- Alluvial diagram showing musician flow between groups
- Audio preview integration

- Mobile-optimized layout
- Full-text search across liner notes / album descriptions
