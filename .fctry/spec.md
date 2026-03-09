```yaml
title: The Jazz Graph
spec-version: "0.10"
spec-format: nlspec-v2
date: 2026-03-09
status: active
author: mike
synopsis:
  short: "Interactive visual encyclopedia exploring 2,000+ jazz albums through seven data dimensions — color, artists, instruments, labels, time, sound, and words"
  medium: "The Jazz Graph is a static web app that visualizes jazz through seven thematic lenses. Each category contains multiple sub-visualizations — from a hue-sorted cover mosaic to geographic maps of song title references — all built on 2,000+ albums with full track listings, session lineups, and real cover art in a Blue Note-inspired dark aesthetic. A repeatable data quality audit catches reissues, compilations, and metadata gaps."
  readme: "The Jazz Graph is an interactive encyclopedia of jazz, built for discovery. Starting from 2,000+ albums (sourced from MusicBrainz), it reveals the hidden structure of jazz through seven thematic categories: Color (cover art mosaic), Artists (collaborations and careers), Instruments (families and eras), Labels (rosters and transitions), Time (chronological browsing), Sound (instrument combinations and sonic texture), and Words (semantic mining of song and album titles for geography, mood, musical vocabulary, and nature imagery). Each category contains multiple visualization panels accessed via sub-navigation tabs. Every view is crafted in a dark, typographically bold aesthetic inspired by Reid Miles' iconic Blue Note Records covers. A post-build audit pipeline flags reissues, compilations, label-era mismatches, and metadata gaps with human-in-the-loop review and quarantine-based removal."
  stack:
    - JavaScript
    - React + Vite
    - D3.js
    - MusicBrainz API
    - Spotify API (cover art)
    - Static site deployment
  patterns:
    - Static SPA with pre-built data
    - Build-time data pipeline
    - Client-side routing with nested sub-navigation
    - Category + sub-view navigation model
    - Multiple specialized data visualizations
    - Design token system
  goals:
    - Visualize jazz through seven thematic data dimensions with multiple viz types per dimension
    - Provide a browsable encyclopedia experience with real album art
    - Maintain Blue Note-inspired visual identity across all views
    - Perform fluidly with 2,000+ albums on commodity hardware
    - Mine semantic meaning from 15,000+ song and album titles
plugin-version: 0.28.0
```

# The Jazz Graph

## 1. Experience Vision

The Jazz Graph is a visual encyclopedia of jazz. It makes visible what liner notes only hint at — the dense, fascinating web of who played with whom, when, and on what instrument.

The experience is **discovery-driven**. You land on a mosaic of album covers sorted by color. You switch to Artists and see a radial chart of the most prolific musicians. You drill into the collaboration network and discover that Ron Carter connects to 47 other musicians. You switch to Words and see a world map lit up with place names pulled from thousands of song titles — "Havana", "Paris", "Harlem", "Tokyo."

The app is organized into **seven thematic categories**, each containing multiple visualization panels accessed via sub-navigation tabs. This structure scales naturally as new visualizations are added.

### Design Language

Dark, high-contrast, typographically bold — inspired by Reid Miles' Blue Note Records covers from the 1950s-60s. This isn't a generic dashboard. It's a love letter to jazz presented through data.

- **Typography:** Bold serif for headings (display weight), monospace for metadata and data labels
- **Color:** Instrument-family color system (brass = warm orange/red, reeds = gold, keys = blue, rhythm = purple/green, strings = pink, mallets = teal). Label colors as accents.
- **Texture:** Subtle film grain overlay. Deep blacks. Restrained use of glow on interactive elements.
- **Layout:** Each visualization panel is its own distinct dataviz format. Inspired by the diversity of types at datavizproject.com.

## 2. Data

### Source & Pipeline

A build-time pipeline fetches and assembles the dataset from a curated artist roster.

**Architecture:** The library is built top-down from `data/artist-roster.json`, which declares the artists and labels to include. The rebuild script fetches complete discographies from MusicBrainz, filters out reissues and posthumous releases, then fetches album details (lineup, label, year) for each remaining entry.

**Rebuild workflow:**
1. **Browse** — Fetch discographies for all roster artists + label catalogs (`--browse` flag)
2. **Filter** — Remove posthumous releases (lifetime + 10 years), reissue title patterns, duplicate titles, junk budget labels (`scripts/filter-catalog.mjs`)
3. **Fetch** — Fetch album details for the filtered catalog (`--resume` flag)
4. **Cover art** — Spotify API 640px (primary), Cover Art Archive (fallback)
5. **Color extraction** — Dominant color (HSL) extracted from each cover image
6. **Post-processing** — Instrument normalization, date correction, label correction, lead instrument resolution

**Rebuild scripts:**
```
node scripts/rebuild-library.mjs --browse   # Phase 1: browse discographies
node scripts/filter-catalog.mjs             # Filter catalog
node scripts/rebuild-library.mjs --resume   # Phase 2: fetch album details
node scripts/fetch-spotify-covers.mjs       # Spotify 640px art (primary)
node scripts/fetch-covers.mjs               # Cover Art Archive (fallback)
node scripts/extract-colors.mjs             # Dominant color from covers
node scripts/audit-library.mjs              # Post-build quality audit (on-demand)
```

**Artist roster:** `data/artist-roster.json` contains a curated list of ~76 artists and label catalogs (e.g., Groove Merchant Records). New artists are added manually after reviewing sideman candidates that appear frequently in existing lineups.

### Data Quality Audit

A repeatable post-build audit scans the finished library for albums that weaken data quality. Run on-demand against `albums.json` — not part of every rebuild, but used when the library feels suspect or after adding new artists.

**Audit checks (ordered by confidence):**

| Check | Signal | Confidence |
|-------|--------|------------|
| MB secondary types | Compilation, Live, Remix, DJ-mix, Mixtape/Street | High |
| Posthumous release | Album year > artist death + 10 years | High |
| Reissue title patterns | "best of", "remastered", "complete sessions", etc. | High |
| Junk/budget label | Known reissue imprints (Waxtime, Laserlight, etc.) | High |
| Label-era mismatch | Classic label outside its active recording window | Medium |
| Suspect date | Year far from artist's active period | Medium |
| Thin lineup | 0–1 musicians in lineup | Low |
| Missing tracks | No track data at all | Low |

**Label-era definitions:** A map of label name → active recording years (e.g., Prestige: 1949–1975, Riverside: 1953–1964). Albums credited to a label outside its window receive medium-confidence flags requiring human review. The map lives in the audit script.

**Audit workflow:**
1. `node scripts/audit-library.mjs` — scans library, produces `data/audit-report.json` with issue type, action (REMOVE / FIX_DATE / FLAG), confidence, and reason
2. `node scripts/audit-library.mjs --review` — interactive terminal review: displays each flagged album, user approves or rejects the recommended action
3. `node scripts/audit-library.mjs --apply` — executes approved actions: removals go to `data/quarantine.json` (restorable), date fixes update in-place

**One-time backfill:** `node scripts/audit-library.mjs --backfill-types` fetches MusicBrainz secondary types for all existing albums (via release-group lookup) and stores them in the album record as `secondaryTypes: string[]`. After backfill, the MB type check runs locally without API calls.

**Output files:**
- `data/audit-report.json` — flagged albums with reasons and recommended actions
- `data/quarantine.json` — removed albums (restorable archive)

**Quarantine model:** Albums are never deleted. Approved removals move from `albums.json` to `data/quarantine.json` with a timestamp and reason. Cover images are preserved. Albums can be restored by moving them back.

### Data Schema

```
Album {
  id: string (slugified artist-title)
  title: string
  artist: string (bandleader / credited artist)
  year: number (original release year)
  label: string
  coverPath: string | null (local image path)
  dominantColor: { h: number, s: number, l: number } | null
  mbid: string (MusicBrainz release ID)
  rgid: string (MusicBrainz release-group ID)
  secondaryTypes: string[] (MB release-group types: Compilation, Live, etc.)
  spotifyId: string | null
  lineup: Musician[]
  tracks: Track[]
}

Musician {
  name: string (normalized across albums)
  instrument: string
  lead: boolean
}

Track {
  title: string
  position: number
  lengthMs: number | null
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

Record labels have assigned brand colors used throughout the app.

**Primary labels (11):** Blue Note (#0070c0), Columbia (#c41e3a), Impulse! (#e8740c), Prestige (#6b3fa0), Riverside (#2d8659), Atlantic (#cc9b26), ECM (#5a7d8c), Verve (#b38600), EmArcy (#8b5e3c), Warner Bros. (#3d6b4f), Mercury (#7a4466).

**Secondary labels (12):** Contemporary (#8a6e45), RCA Victor (#b5343c), Capitol (#9b4d6e), ESP-Disk' (#7a8a5c), Polydor (#c47830), United Artists (#6a7a9a), Debut (#5e8a6e), Vogue (#9a6080), A&M (#7a6a9a), Fantasy (#5a8a7a), Candid (#8a5a5a), Pacific Jazz (#5a7a8a).

Unrecognized labels use neutral gray (#888).

## 3. Views

### Navigation Model

The app uses a **two-level navigation** system:

- **Primary nav** (top bar): 7 category pills — Color · Artists · Instruments · Labels · Time · Sound · Words
- **Sub-nav** (secondary pill row below primary): switches between visualization panels within the active category. One panel visible at a time.

Sub-nav selections are encoded in the URL as path segments (e.g., `/labels/flow`, `/instruments/eras`). The first sub-view in each category is the default when navigating to the category root.

### 3.1 Color (Home — `/`)

The landing page. A dense, edge-to-edge grid of album covers sorted by dominant color — no metadata, no gaps, no rounded corners. The covers flow through the hue spectrum.

**Sub-views:** None (single panel).

**Layout:** Square cover images tiled with zero padding/gap. No text or overlays.

**Sort order:** Albums sorted by dominant hue. Albums without covers placed at end.

**Interaction:** Click navigates to album detail. Hover shows subtle brightness shift.

### 3.2 Artists (`/artists`)

Visualizations centered on the people who made the music.

**Sub-views:**
- **Overview** (`/artists` default) — Radial bar chart of top artists by album count, colored by primary instrument family. Shows the most prolific musicians at a glance.
- **Network** (`/artists/network`) — Force-directed graph showing musician-album connections. Nodes are albums (colored by label) and musicians (colored by primary instrument). Edges connect musicians to albums. Zoom, pan, drag. Hover highlights connections. Click navigates to detail pages.
- **Connections** (`/artists/connections`) — Six Degrees of Jazz. Two autocomplete inputs let you pick any two musicians; a BFS path-finder shows the shortest chain of shared albums connecting them. Includes a "most connected" leaderboard.
- **Careers** (`/artists/careers`) — Career span chart showing each artist's first to last album as a horizontal bar on a year axis. Sorted by career start date. Reveals generational clusters and longevity patterns.

### 3.3 Instruments (`/instruments`)

Visualizations centered on what was played.

**Sub-views:**
- **Overview** (`/instruments` default) — Radial bar chart of lead instruments by album count, colored by instrument family. Shows which instruments dominate jazz leadership. Below the main chart, a "Rare Instruments" section displays all instruments appearing fewer than 5 times — the long tail of jazz's instrumental palette (koto, uilleann pipes, berimbau, ocarina, etc.). Each rare instrument links to the album(s) it appears on.
- **Eras** (`/instruments/eras`) — Streamgraph showing instrument family prevalence across the jazz timeline. D3 stack with `stackOffsetWiggle` and `curveBasis`. Each stream colored by family. Hover shows family/year/count. Reveals how jazz's instrumental palette shifted over decades.

**Filter bar:** Instrument family pills, top label pills with overflow, artist autocomplete. Filters apply across all sub-views.

### 3.4 Labels (`/labels`)

Visualizations centered on the business of jazz.

**Sub-views:**
- **Overview** (`/labels` default) — Radial bar chart of labels by album count, using label brand colors. Shows the landscape of jazz recording.
- **Browse** (`/labels/browse`) — Filterable grid of album cards grouped by label with colored section headers. Search across title, artist, musician, instrument, label. Instrument family filter pills.
- **Flow** (`/labels/flow`) — Alluvial diagram showing how musicians moved between labels across time periods (1949–55, 1956–60, 1961–65, 1966–70, 1971–75, 1976–80, 1981+). Nodes represent labels sized by musician count. Ribbons show transitions.

**Filter bar:** Instrument family pills, top label pills with overflow, artist autocomplete. Filters apply across all sub-views.

### 3.5 Time (`/time`)

Visualizations centered on when the music was made.

**Sub-views:**
- **Timeline** (`/time` default) — Chronological view. Albums grouped by year, laid out vertically. Year headings as typographic anchors, album covers in horizontal rows. Deep-linking via `?year=YYYY`.
- **Density** (`/time/density`) — Albums per year bar chart showing recording activity over time. Reveals boom periods and quiet years.
- **Ensembles** (`/time/ensembles`) — Lineup size trend over decades. Shows whether jazz ensembles got bigger or smaller over time.

**Filter bar:** Instrument family pills, top label pills with overflow, artist autocomplete.

### 3.6 Sound (`/sound`)

Visualizations centered on what the music sounds like — the sonic texture of jazz sessions, revealed through instrument combinations and ensemble voicings.

**Sub-views:**
- **Combos** (`/sound` default) — Lead-to-sideman Sankey diagram. Left column: every instrument that appears as lead on an album. Right column: every other instrument on those sessions. Ribbons connect lead instruments to co-occurring sideman instruments, sized by album count. Colored by instrument-family palette. Reveals the canonical jazz combos: when trumpet leads, the band is piano + tenor sax + bass + drums; when guitar leads, it's a different world. Hover highlights a single lead's connections. Click a ribbon to see the matching albums.
- **Durations** (`/sound/durations`) — Track duration distribution. How long is a jazz track? Histogram showing the spread, with median line and notable outliers labeled.
- **By Era** (`/sound/by-era`) — Average track duration by decade. Did jazz tracks get longer over time? (Spoiler: yes, dramatically.)
- **Track Counts** (`/sound/tracks`) — Distribution of tracks per album. Reveals format conventions (LP sides, CD-era expansion).

### 3.7 Words (`/words`)

Semantic mining of album and song titles — 15,000+ titles analyzed for recurring themes.

**Sub-views:**
- **Geography** (`/words` default) — Place names extracted from titles, plotted on a stylized dark world map (D3 equirectangular or natural earth projection). Dots sized by frequency. Reveals jazz's geographic imagination — where the music dreams of.
- **Mood** (`/words/mood`) — Radial wheel visualization of emotional themes in album and track titles. 8 emotion categories (joy, love, melancholy, longing, peace, freedom, night, fire) arranged as spokes radiating from center, with keyword nodes along each spoke sized by frequency. Click any category or keyword to drill down into matching albums/tracks. Secondary view: "Mood by Decade" heatmap showing how jazz's emotional vocabulary shifted across eras — stacked area or heat grid with decade columns and mood rows. Title-based analysis using keyword dictionaries.
- **Vocabulary** (`/words/vocabulary`) — Frequency of musical form words (blues, bossa, waltz, swing, ballad, groove) as a treemap or radial layout. Adjacent section for jazz slang (cookin', blowin', groovin', etc.) if data density supports it.
- **Imagery** (`/words/imagery`) — Time-of-day, seasons, weather, celestial references extracted from titles. Rendered as a clock face, calendar wheel, or seasonal arc. When does jazz happen in its own imagination?

### 3.8 Album Detail (`/album/:slug`)

A dedicated full page for each album.

**Header:** Large cover art, title, artist (links to artist page), year (links to `/time?year=YYYY`), label (links to `/labels/browse` filtered by label).

**Track listing:** Full track list with titles and durations (when available).

**Lineup:** Full list of musicians with instrument and lead status. Each name links to the artist page.

**Connections:** Section showing other albums that share musicians, ranked by shared personnel count.

### 3.9 Artist Detail (`/artist/:slug`)

A dedicated full page for each artist.

**Header:** Artist name, photo (if available), instrument badges, album count, leader count.

**Timeline:** Horizontal, year-axis. Each album is a node. Leader appearances are visually prominent, sideman appearances subdued.

**Collaborators:** Top collaborators ranked by shared-album count, with links.

**Discography:** Grid of album covers (all appearances), sortable by year.

## 4. Navigation & Routing

Client-side routing with nested paths:

```
/                        — Color Mosaic (home)
/artists                 — Artists: Overview (default)
/artists/network         — Artists: Network
/artists/connections     — Artists: Connections
/artists/careers         — Artists: Careers
/instruments             — Instruments: Overview (default)
/instruments/eras        — Instruments: Eras
/labels                  — Labels: Overview (default)
/labels/browse           — Labels: Browse
/labels/flow             — Labels: Flow
/time                    — Time: Timeline (default)
/time/density            — Time: Density
/time/ensembles          — Time: Ensembles
/sound                   — Sound: Combos (default)
/sound/durations         — Sound: Durations
/sound/by-era            — Sound: By Era
/sound/tracks            — Sound: Track Counts
/words                   — Words: Geography (default)
/words/mood              — Words: Mood
/words/vocabulary        — Words: Vocabulary
/words/imagery           — Words: Imagery
/album/:slug             — Album Detail
/artist/:slug            — Artist Detail
```

**Primary nav bar:** 7 category pills at top. Active category indicated. "The Jazz Graph" title links home.

**Sub-nav bar:** Secondary row of smaller pills below primary nav, showing available panels for the active category. Active panel indicated. Only visible on category pages (hidden on detail pages and Color home).

**Detail pages:** Primary and sub-nav hidden. Title remains as home link. "← Back" link for navigation context.

**Behavior:**
- Browser back/forward works correctly
- All routes are bookmarkable and load directly
- Filter state preserved in URL search params
- Clicking any musician name navigates to their artist page
- Clicking any album reference navigates to its album page
- Navigating to a category root (e.g., `/labels`) loads the default sub-view

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

1. **Data pipeline** — Metadata, tracks, cover art, color extraction for 2,000+ albums
2. **Navigation scaffold** — Two-level nav system with category + sub-view routing
3. **Color mosaic** — Dense cover grid sorted by hue (home page)
4. **Labels category** — Overview radial bar, Browse grid, Flow alluvial
5. **Instruments category** — Overview radial bar, Eras streamgraph
6. **Artists category** — Overview radial bar, Network graph, Careers chart
7. **Time category** — Timeline, Density chart, Ensembles trend
8. **Sound category** — Duration distribution, By Era chart, Track Counts
9. **Words category** — Geography map, Mood landscape, Vocabulary treemap, Imagery wheel
10. **Polish** — Performance, responsive tweaks, animation refinement

## 7. Future Enhancements (Not in v1)

- Audio preview integration
- Mobile-optimized layout
- Artist birthplace/nationality data from MusicBrainz
- Genre/style tags from MusicBrainz
- Recording location/studio data
