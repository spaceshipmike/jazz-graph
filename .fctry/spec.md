```yaml
title: The Jazz Graph
spec-version: "0.14"
spec-format: nlspec-v2
date: 2026-03-13
status: active
author: mike
synopsis:
  short: "Interactive visual encyclopedia exploring 2,200+ jazz albums through seven data dimensions with subgenre taxonomy and shape iconography"
  medium: "The Jazz Graph is a static web app that visualizes jazz through seven thematic lenses. Each category contains multiple sub-visualizations — from a hue-sorted cover mosaic to geographic maps of song title references — all built on 2,200+ albums with full track listings, session lineups, subgenre classifications, and real cover art in a Blue Note-inspired dark aesthetic. A 15-subgenre taxonomy with geometric shape icons threads through filters, detail pages, timeline markers, and search."
  readme: "The Jazz Graph is an interactive encyclopedia of jazz, built for discovery. Starting from 2,200+ albums (sourced from MusicBrainz, enriched via Discogs and Spotify), it reveals the hidden structure of jazz through seven thematic categories: Color (cover art mosaic), Artists (collaborations and careers), Instruments (families and eras), Labels (rosters and transitions), Time (chronological browsing with subgenre evolution markers), Sound (instrument combinations and sonic texture), and Words (semantic mining of song and album titles for geography, mood, musical vocabulary, and nature imagery). Each category contains multiple visualization panels accessed via sub-navigation tabs. A 15-subgenre taxonomy — from bebop to bossa nova — uses geometric shape families to communicate stylistic lineage, appearing as filterable pills, detail page badges, timeline markers, and searchable metadata. Every view is crafted in a dark, typographically bold aesthetic inspired by Reid Miles' iconic Blue Note Records covers. A post-build audit pipeline flags reissues, compilations, label-era mismatches, and metadata gaps with human-in-the-loop review and quarantine-based removal."
  stack:
    - JavaScript
    - React + Vite
    - D3.js
    - MusicBrainz API
    - Discogs API (subgenre styles)
    - Spotify API (cover art)
    - Static site deployment
  patterns:
    - Static SPA with pre-built data
    - Build-time data pipeline
    - Multi-source data enrichment (MusicBrainz + Discogs + Spotify)
    - Client-side routing with nested sub-navigation
    - Category + sub-view navigation model
    - Multiple specialized data visualizations
    - Design token system
    - Geometric shape icon system for categorical identity
  goals:
    - Visualize jazz through seven thematic data dimensions with multiple viz types per dimension
    - Provide a browsable encyclopedia experience with real album art
    - Classify albums by subgenre using a canonical 15-style taxonomy with geometric shape iconography
    - Maintain Blue Note-inspired visual identity across all views
    - Perform fluidly with 2,200+ albums on commodity hardware
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

- **Typography:** Oswald Light (sans-serif, weight 300) for headings, monospace for metadata and data labels, Source Serif 4 for body text
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
node scripts/enrich-subgenres.mjs           # Subgenre enrichment (Discogs + MB)
node scripts/audit-library.mjs              # Post-build quality audit (on-demand)
```

**Subgenre enrichment pipeline (`scripts/enrich-subgenres.mjs`):**

A post-build enrichment step that assigns subgenre classifications to each album using three sources in priority order:

1. **Discogs styles** (primary, ~85-95% coverage) — Match albums to Discogs releases by artist + title. Discogs "styles" map directly to jazz subgenres. Stored as `discogsStyles: string[]` for provenance.
2. **MusicBrainz release-group genres** (secondary, ~30-40% coverage) — Genre tags on the release group.
3. **MusicBrainz artist genres** (fallback, ~100% of artists) — Genre tags on the credited artist, applied to albums that lack release-level data.

The script is resumable and rate-limited, following the patterns of existing pipeline scripts. Progress is tracked in `data/.discogs-enrich-progress.json`. Total enrichment run time is approximately 90 minutes across all three sources.

All source-specific genre/style strings are normalized through a canonical map (see Subgenre Taxonomy below) to produce the final `subgenres: string[]` field on each album.

**Artist roster:** `data/artist-roster.json` contains a curated list of ~71 artists and label catalogs (e.g., Groove Merchant Records). New artists are added manually after reviewing sideman candidates that appear frequently in existing lineups.

### Data Quality Audit

A repeatable post-build audit scans the finished library for albums that weaken data quality. Run on-demand against `albums.json` — not part of every rebuild, but used when the library feels suspect or after adding new artists.

**Audit checks (ordered by confidence):**

| Check | Signal | Confidence |
|-------|--------|------------|
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
  vibrant: { rgb: string, oklch: string, swatch: [r,g,b] } | null
  palette: { lab: [L,a,b], pct: number }[] | null
  mbid: string (MusicBrainz release ID)
  rgid: string (MusicBrainz release-group ID)
  spotifyId: string | null
  subgenres: string[] (canonical subgenre names, e.g. ["hard bop", "modal jazz"])
  discogsStyles: string[] (raw Discogs style strings, for provenance)
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

**Primary labels (16):** Blue Note (#0070c0), Columbia (#c41e3a), Impulse! (#e8740c), Prestige (#6b3fa0), Riverside (#2d8659), Atlantic (#cc9b26), ECM (#5a7d8c), Verve (#b38600), Pablo (#c27830), Milestone (#8a5a3c), Groove Merchant (#4a8a6e), EmArcy (#8b5e3c), Warner Bros. (#3d6b4f), Mercury Records (#7a4466), Telarc Jazz (#6a7a3a), Savoy Records (#9a6a4a).

**Secondary labels (12):** Contemporary (#8a6e45), RCA Victor (#b5343c), Capitol (#9b4d6e), ESP-Disk' (#7a8a5c), Polydor (#c47830), United Artists (#6a7a9a), Debut (#5e8a6e), Vogue (#9a6080), A&M (#7a6a9a), Fantasy (#5a8a7a), Candid (#8a5a5a), Pacific Jazz (#5a7a8a).

Unrecognized labels use neutral gray (#888).

### Subgenre Taxonomy

A canonical set of 15 jazz subgenres, normalized from Discogs styles and MusicBrainz genres into a unified lowercase taxonomy:

**hard bop**, **bebop**, **cool jazz**, **post-bop**, **modal jazz**, **free jazz**, **soul jazz**, **jazz fusion**, **jazz-funk**, **latin jazz**, **avant-garde jazz**, **big band**, **spiritual jazz**, **swing**, **bossa nova**

The normalization map merges variant spellings and casing across sources (e.g., Discogs "Hard Bop", "Post Bop", "Modal" and MB "hard bop", "post-bop", "modal jazz") into these canonical strings. Albums may have multiple subgenres.

### Subgenre Shape System

Each subgenre is identified by a small geometric shape icon, grouped into five shape families that communicate stylistic lineage. Shapes are rendered as inline SVGs for cross-browser consistency.

**Circle family** (bop lineage):
- Filled circle — bebop
- Outline circle — hard bop
- Half circle — post-bop
- Dot-in-circle — modal jazz

**Triangle family** (boundary-pushing / avant-garde):
- Filled triangle — free jazz
- Outline triangle — avant-garde jazz
- Inverted triangle — spiritual jazz

**Diamond family** (groove / feel-driven):
- Filled diamond — soul jazz
- Outline diamond — jazz-funk
- Small diamond — bossa nova

**Square family** (ensemble / fusion):
- Filled square — big band
- Outline square — swing
- Half square — jazz fusion

**Hexagon / other** (cool / latin):
- Hexagon — cool jazz
- Four-point star — latin jazz

**Color:** All shapes use neutral tones (`--fg-dim` or `--fg-muted`) to avoid competing with the instrument-family color system. Shape families communicate stylistic relationships through geometry, not color.

**Usage across the app:**
- **FilterBar** — Subgenre shape pills as a new filter dimension (see Section 3.4, 3.5)
- **Album Detail** — Subgenre badges with shape + label text (see Section 3.8)
- **Artist Detail** — Subgenre badges summarizing the artist's stylistic range (see Section 3.9)
- **Timeline** — First/last markers for each subgenre (see Section 3.5)
- **Search** — Subgenre names as a searchable field (see Section 3.10)

## 3. Views

### Navigation Model

The app uses a **two-level navigation** system:

- **Primary nav** (top bar): 7 category pills — Color · Artists · Instruments · Labels · Time · Sound · Words — plus a magnifying glass search icon (links to `/search`). Active category indicated. "The Jazz Graph" title links home.
- **Sub-nav** (secondary pill row below primary): switches between visualization panels within the active category. One panel visible at a time.

**Responsive behavior (screens <=768px):** The nav pills wrap to a second row below the title instead of overflowing offscreen. The title sits on the first row; the category pills and search icon flow onto the next row(s). No hamburger menu, no horizontal scroll — all pills remain visible and tappable.

Sub-nav selections are encoded in the URL as path segments (e.g., `/labels/flow`, `/instruments/eras`). The first sub-view in each category is the default when navigating to the category root.

### 3.1 Color (Home — `/`)

The landing page. A dense, edge-to-edge grid of album covers sorted by dominant color — no metadata, no gaps, no rounded corners. The covers flow through the hue spectrum.

**Sub-views:** None (single panel).

**Layout:** Square cover images tiled with zero padding/gap. No text or overlays.

**Sort order:** Albums sorted using CIELAB color analysis — covers are tiered by luminance (black, dark, chromatic, light, white) then sorted by weighted chromatic hue from palette data. This produces a visually coherent spectrum rather than naive HSL hue sorting. Albums without covers placed at end.

**Interaction:** Click navigates to album detail. Hover shows subtle brightness shift.

### 3.2 Artists (`/artists`)

Visualizations centered on the people who made the music.

**Sub-views:**
- **Overview** (`/artists` default) — Horizontal bar chart of top artists by album count, colored by primary instrument family. Shows the most prolific musicians at a glance. Includes stat cards and an instrument breakdown section.
- **Network** (`/artists/network`) — Force-directed graph showing musician-to-musician collaboration connections. Nodes are musicians colored by primary instrument. Edges connect musicians who shared an album. Zoom, pan, drag. Hover highlights connections. Click navigates to detail pages.
- **Connections** (`/artists/connections`) — Six Degrees of Jazz. Two autocomplete inputs let you pick any two musicians; a BFS path-finder shows the shortest chain of shared albums connecting them. Includes a "most connected" leaderboard.
- **Careers** (`/artists/careers`) — Career span chart showing each artist's first to last album as a horizontal bar on a year axis. Sorted by career start date. Reveals generational clusters and longevity patterns.

### 3.3 Instruments (`/instruments`)

Visualizations centered on what was played.

**Sub-views:**
- **Overview** (`/instruments` default) — Horizontal bar chart of lead instruments by album count, colored by instrument family. Shows which instruments dominate jazz leadership. Below the main chart, a "Rare Instruments" section displays all instruments appearing fewer than 5 times — the long tail of jazz's instrumental palette (koto, uilleann pipes, berimbau, ocarina, etc.). Each rare instrument links to the album(s) it appears on.
- **Eras** (`/instruments/eras`) — Streamgraph showing instrument family prevalence across the jazz timeline. D3 stack with `stackOffsetWiggle` and `curveBasis`. Each stream colored by family. Hover shows family/year/count. Reveals how jazz's instrumental palette shifted over decades.

### 3.4 Labels (`/labels`)

Visualizations centered on the business of jazz.

**Sub-views:**
- **Overview** (`/labels` default) — Horizontal bar chart of labels by album count, using label brand colors. Shows the landscape of jazz recording.
- **Browse** (`/labels/browse`) — Filterable grid of album cards grouped by label with colored section headers. Search across title, artist, musician, instrument, label. Instrument family filter pills.
- **Flow** (`/labels/flow`) — Alluvial diagram showing how musicians moved between labels across time periods (1949–55, 1956–60, 1961–65, 1966–70, 1971–75, 1976–80, 1981+). Nodes represent labels sized by musician count. Ribbons show transitions.

**Filter bar:** Instrument family pills, subgenre shape pills, top label pills with overflow, artist autocomplete. Filters apply across all sub-views. Subgenre pills display the shape icon alongside the subgenre name; clicking a subgenre pill filters the view to albums classified under that subgenre. Multiple subgenre pills can be active simultaneously (union filter — albums matching any selected subgenre are shown).

### 3.5 Time (`/time`)

Visualizations centered on when the music was made.

**Sub-views:**
- **Timeline** (`/time` default) — Chronological view. Albums grouped by year, laid out vertically. Year headings as typographic anchors, album covers in horizontal rows. Deep-linking via `?year=YYYY`. **Subgenre evolution markers:** For each subgenre in the canonical taxonomy, the timeline displays markers at the year of its first and last appearance in the library. These tell the story of how jazz styles emerged and faded — when hard bop first appeared, when swing's last recording was made, when fusion arrived. Markers use the subgenre's shape icon and are positioned along the year axis.
- **Density** (`/time/density`) — Albums per year bar chart showing recording activity over time. Reveals boom periods and quiet years.
- **Ensembles** (`/time/ensembles`) — Lineup size trend over decades. Shows whether jazz ensembles got bigger or smaller over time.

**Filter bar:** Instrument family pills, subgenre shape pills, top label pills with overflow, artist autocomplete. Subgenre pills display the shape icon alongside the subgenre name; clicking a pill filters to albums of that subgenre.

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
- **Geography** (`/words` default) — Place names extracted from titles, displayed as a circle-pack cartogram grouped by region. Circles sized by frequency. Click to see matching albums. Includes venue-reference filtering. Reveals jazz's geographic imagination — where the music dreams of.
- **Mood** (`/words/mood`) — Radial wheel visualization of emotional themes in album and track titles. 8 emotion categories (joy, love, melancholy, longing, peace, freedom, night, fire) arranged as spokes radiating from center, with keyword nodes along each spoke sized by frequency. Click any category or keyword to drill down into matching albums/tracks. Secondary view: "Mood by Decade" heatmap showing how jazz's emotional vocabulary shifted across eras — stacked area or heat grid with decade columns and mood rows. Title-based analysis using keyword dictionaries.
- **Vocabulary** (`/words/vocabulary`) — Frequency of musical form words (blues, bossa, waltz, swing, ballad, groove) as a treemap or radial layout. Adjacent section for jazz slang (cookin', blowin', groovin', etc.) if data density supports it.
- **Imagery** (`/words/imagery`) — Time-of-day, seasons, weather, celestial, and nature references extracted from titles. Grouped horizontal bar chart by category. When does jazz happen in its own imagination?

### 3.8 Album Detail (`/album/:slug`)

A dedicated full page for each album.

**Header:** Large cover art, title, artist (links to artist page), year (links to `/time?year=YYYY`), label (links to `/labels/browse` filtered by label). **Subgenre badges:** Below the year/label metadata, the album's subgenres are displayed as badges — each showing the subgenre's shape icon alongside the name text. Albums without subgenre data show no badges (no empty state).

**Track listing:** Full track list with titles and durations (when available).

**Lineup:** Full list of musicians with instrument and lead status. Each name links to the artist page.

**Connections:** Section showing other albums that share musicians, ranked by shared personnel count.

### 3.9 Artist Detail (`/artist/:slug`)

A dedicated full page for each artist.

**Header:** Artist name, photo (if available), instrument badges, album count, leader count. **Subgenre badges:** The header also shows subgenre badges representing the distinct subgenres across this artist's entire discography — each badge displays the shape icon and name. This reveals the artist's stylistic range (e.g., Miles Davis spanning bebop, hard bop, modal jazz, and jazz fusion).

**Timeline:** Horizontal, year-axis. Each album is a node. Leader appearances are visually prominent, sideman appearances subdued.

**Collaborators:** Top collaborators ranked by shared-album count, with links.

**Discography:** Grid of album covers (all appearances), sortable by year.

### 3.10 Search (`/search`) {#search}

A dedicated search page for finding albums, artists, and tracks across the entire dataset.

**Route:** `/search?q=...`

**Input:** A text input field, autofocused on page load. The query string is reflected in the URL's `q` parameter so search results are bookmarkable and shareable.

**Search method:** Client-side substring matching against the existing data index (`buildIndex()` output). Searches album titles, artist/musician names, track titles, and subgenre names. A query like "bossa" matches albums classified under "bossa nova"; "fusion" matches "jazz fusion". Results appear within 100ms of typing.

**Results display:** Results are grouped into three sections, each with a count in the section header:

- **Albums** — Cover art thumbnail, title, artist name, year. Each result links to `/album/:slug`.
- **Artists** — Name, primary instrument, album count. Each result links to `/artist/:slug`.
- **Tracks** — Track title, album title, artist name. Each result links to the parent album at `/album/:slug`.

Sections with zero results for the current query are hidden.

**Empty state:** When no query has been entered, the page shows instructional text inviting the user to search.

**No-results state:** When a query matches nothing across all three types, a message indicates no results were found.

**Nav behavior:** The Search page shows the primary nav bar (with the search icon visually active) but no sub-nav row.

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
/search                  — Global Search
/album/:slug             — Album Detail
/artist/:slug            — Artist Detail
/about                   — About
```

**Primary nav bar:** 7 category pills at top, plus a magnifying glass search icon. Active category indicated. "The Jazz Graph" title links home. On screens <=768px, pills wrap below the title to a second row — no hamburger menu, no horizontal scroll.

**Sub-nav bar:** Secondary row of smaller pills below primary nav, showing available panels for the active category. Active panel indicated. Only visible on category pages (hidden on detail pages and Color home).

**Detail pages:** Sub-nav hidden. Primary nav remains visible. Title remains as home link. "← Back" button for navigation context.

**About page** (`/about`): Accessible via "?" icon in the nav bar. Describes the project, data sources, and credits.

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
  surface:      #0e0e11
  surface-hover:#141417
  border:       #1e1e22
  border-light: #2a2a2e
  fg:           #e8e4dc
  fg-dim:       #aaa
  fg-muted:     #777
  fg-ghost:     #555

  brass:        #e85d3a
  reeds:        #d4a843
  keys:         #5b9bd5
  rhythm-bass:  #7c5cbf
  rhythm-drums: #45a67d
  strings:      #c75d8f
  mallets:      #6bb5a0
  vocals:       #d48db0

Typography:
  heading:      Oswald Light (300 weight, sans-serif)
  body:         Source Serif 4 (serif)
  mono:         SF Mono / Menlo / Consolas, for metadata/labels/data

Spacing:
  page-padding: 32px
  card-gap:     16px
  section-gap:  48px

Transitions:
  default:      200ms ease
  card-hover:   300ms cubic-bezier(0.2, 0, 0, 1)
  stagger:      40ms per item

Subgenre shapes:
  render:       inline SVG (not Unicode glyphs — cross-browser consistency)
  color:        --fg-dim (#aaa) default, --fg-muted (#777) for inactive states
  size:         14–16px inline with text (badges), 20–24px in filter pills
  families:     circle (bop), triangle (avant-garde), diamond (groove),
                square (ensemble/fusion), hexagon/star (cool/latin)
  interaction:  filter pills are clickable, badges are display-only
```

## 6. Build Order

1. **Data pipeline** — Metadata, tracks, cover art, color extraction for 2,000+ albums
2. **Navigation scaffold** — Two-level nav system with category + sub-view routing
3. **Color mosaic** — Dense cover grid sorted by hue (home page)
4. **Labels category** — Overview bars, Browse grid, Flow alluvial
5. **Instruments category** — Overview bars, Eras streamgraph
6. **Artists category** — Overview bars, Network graph, Careers chart
7. **Time category** — Timeline, Density chart, Ensembles trend
8. **Sound category** — Duration distribution, By Era chart, Track Counts
9. **Words category** — Geography cartogram, Mood wheel, Vocabulary treemap, Imagery bars
10. **Polish** — Performance, responsive tweaks, animation refinement

## 7. Future Enhancements (Not in v1)

- Audio preview integration
- Mobile-optimized layout (beyond nav — visualization-specific responsive work)
- Artist birthplace/nationality data from MusicBrainz
- Recording location/studio data
