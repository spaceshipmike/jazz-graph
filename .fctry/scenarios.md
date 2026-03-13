# The Jazz Graph — Scenarios

## S1: Data Pipeline Produces Valid Dataset
A developer configures the artist roster (`data/artist-roster.json`), runs the rebuild pipeline, then fetches cover art and extracts colors. The output is a JSON file containing 2,000+ albums sourced from the curated roster.

**Satisfied when:**
- Artist roster defines the source artists and label catalogs
- Rebuild script (`rebuild-library.mjs`) fetches discographies and album details from MusicBrainz
- Filter script (`filter-catalog.mjs`) removes posthumous releases, reissue titles, duplicates, and junk labels
- Output JSON contains 2,000+ albums with complete metadata
- Each album has at least one musician in the lineup
- Albums have a `tracks` array with title, position, and duration for each track
- 50%+ of albums have a downloaded cover image with `dominantColor` HSL values
- Musician names are normalized (same person = same string across albums)
- Each album has `secondaryTypes` from MusicBrainz (populated via backfill or at fetch time)

## S14: Data Quality Audit Catches Suspect Albums
A developer runs the audit script against the finished library. The script flags reissues, compilations, posthumous releases, label-era mismatches, thin lineups, and missing tracks. The developer reviews flagged items interactively and applies approved actions. Removed albums go to quarantine, not deletion.

**Satisfied when:**
- `audit-library.mjs` scans `albums.json` and produces `data/audit-report.json`
- Report entries include issue type, action (REMOVE/FIX_DATE/FLAG), confidence (high/medium/low), and human-readable reason
- High-confidence checks: MB secondary types (Compilation/Live/Remix), posthumous (death+10), reissue title patterns, junk labels
- Medium-confidence checks: label-era mismatch (classic label outside active window), suspect date
- Low-confidence checks: thin lineup (0–1 musicians), missing tracks
- `--review` flag enables interactive terminal review (approve/reject per item)
- `--apply` flag executes approved actions: removals move to `data/quarantine.json` with timestamp and reason
- `--backfill-types` flag fetches MB secondary types for all existing albums and stores in album records
- Quarantined albums are restorable (cover images preserved)
- Running the audit twice without changes produces the same report (idempotent)

## S2: Color Mosaic Loads as Home
A user opens The Jazz Graph. They see a dense, edge-to-edge grid of album covers sorted by dominant color — no gaps, no metadata, no rounded corners. Clicking any cover navigates to the album detail page.

**Satisfied when:**
- Color mosaic renders at `/` as the home view
- Covers are square with no padding, gaps, or rounded corners
- Albums sorted by dominant hue so colors flow through the spectrum
- No metadata visible on the grid — covers only
- Click navigates to album detail page
- Loads within 2 seconds

## S3: Two-Level Navigation Works
A user sees 7 category pills in the primary nav. Clicking "Labels" shows the Labels category with a secondary pill row offering "Overview", "Browse", and "Flow". Clicking "Browse" navigates to `/labels/browse`. The URL is bookmarkable and loads directly.

**Satisfied when:**
- Primary nav shows 7 category pills: Color, Artists, Instruments, Labels, Time, Sound, Words
- Active category is visually indicated
- Sub-nav appears below primary nav with panels for the active category
- Sub-nav pills switch the visible panel without page reload
- URL updates to reflect both category and sub-view (e.g., `/labels/flow`)
- Direct URL access loads the correct category and sub-view
- Detail pages hide both nav levels, show "← Back" and title

## S4: Labels Category
A user navigates to Labels. They see a radial bar chart of top labels by album count. They switch to Browse and see albums grouped by label with filters. They switch to Flow and see the alluvial diagram of label transitions.

**Satisfied when:**
- Overview shows radial bar chart with label brand colors
- Browse shows filterable album grid grouped by label
- Flow shows alluvial diagram of musician label transitions
- Filter bar (instrument family, label, artist) is present and functional
- Sub-nav switches between the three panels
- All three panels render correctly with the full dataset

## S5: Instruments Category
A user navigates to Instruments. They see a radial bar chart of lead instruments. They switch to Eras and see the streamgraph of instrument family prevalence over time.

**Satisfied when:**
- Overview shows radial bar chart of lead instruments colored by family
- Overview includes a "Rare Instruments" section showing instruments with <5 appearances, each linking to its album(s)
- Eras shows streamgraph with instrument family streams over decades
- Filter bar is present and functional
- Both panels render correctly with the full dataset

## S6: Artists Category
A user navigates to Artists. They see a radial bar chart of top artists. They switch to Network and see the force-directed collaboration graph. They switch to Connections and pick two musicians to find the shortest path between them. They switch to Careers and see career span bars.

**Satisfied when:**
- Overview shows radial bar chart of top artists by album count
- Network shows force-directed graph with zoom/pan/hover/click
- Connections shows Six Degrees path-finder with autocomplete inputs and most-connected leaderboard
- Careers shows horizontal career span bars on a year axis
- Click on any artist or album navigates to the detail page

## S7: Time Category
A user navigates to Time. They see the chronological timeline. They switch to Density and see a bar chart of albums per year. Ensembles shows lineup size trends.

**Satisfied when:**
- Timeline shows albums grouped by year with cover art
- Deep-linking via `?year=YYYY` works
- Density shows albums-per-year bar chart
- Ensembles shows lineup size trend over decades
- Filter bar is present and functional

## S8: Sound Category
A user navigates to Sound. They land on a Sankey diagram showing how lead instruments connect to sideman instruments across all sessions — the canonical combos of jazz made visible. They hover a lead instrument and see its connections highlighted. They click a ribbon and see the matching albums. They switch to Durations, By Era, and Track Counts for recording-structure views.

**Satisfied when:**
- Combos (default) shows a lead-to-sideman Sankey diagram
- Left column: lead instruments, right column: co-occurring sideman instruments
- Ribbon width = number of albums sharing that lead-sideman pairing
- Ribbons and nodes colored by instrument-family palette
- Hover on a lead instrument highlights its connections, dimming others
- Click on a ribbon shows the list of albums with that instrument pairing
- Durations shows histogram of track lengths at `/sound/durations`
- By Era shows average duration by decade
- Track Counts shows tracks-per-album distribution
- All panels handle albums without track data gracefully

## S9: Words Category
A user navigates to Words. They see a world map with place names from song/album titles. Mood shows emotional clusters. Vocabulary shows musical form word frequencies. Imagery shows time/nature references.

**Satisfied when:**
- Geography shows a dark-themed map with place name dots from titles
- Mood shows a radial wheel with 8 emotion categories as spokes, keywords radiating outward sized by frequency
- Clicking a mood category or keyword drills down to show matching album/track titles
- Mood by Decade heatmap or stacked area shows emotional vocabulary shifts across eras
- Vocabulary shows musical form word frequencies (blues, bossa, waltz, etc.)
- Imagery shows time-of-day/season/nature references
- Title analysis uses both album titles and track titles (15,000+ data points)

## S10: Album Detail Page
A user clicks an album. They see cover art, metadata, full track listing with durations, complete lineup, and connections to related albums.

**Satisfied when:**
- Page shows cover art, title, artist, year, label
- Track listing displays with titles and durations
- Full lineup with instruments and lead status
- Musician names link to artist pages
- Connections section shows albums sharing musicians
- Bookmarkable URL, browser back works

## S11: Artist Detail Page
A user navigates to an artist page. They see name, instrument badges, horizontal timeline of albums, collaborators, and discography grid.

**Satisfied when:**
- Artist name and instruments displayed prominently
- Timeline shows albums positioned by year
- Leader vs sideman visually differentiated
- Top collaborators listed with shared-album counts
- Album clicks navigate to album detail

## S12: Consistent Design System
Across all views, the design feels cohesive — dark background, instrument-family colors, bold serif headings, monospace metadata, consistent spacing.

**Satisfied when:**
- Single design token system used across all views
- Instrument and label colors are consistent everywhere
- Typography hierarchy is consistent
- Interactive elements share consistent patterns
- Dark theme has sufficient contrast

## S15: Global Search
A user clicks the magnifying glass search icon in the nav header. They land on `/search` with an autofocused text input. They type "monk" and see grouped results: Albums (albums with "monk" in the title), Artists (musicians named "Monk" or matching), and Tracks (track titles containing "monk"). Each section shows its count. They click an album result and navigate to the album detail page. They click an artist result and navigate to the artist detail page. They click a track result and navigate to the parent album's detail page.

**Satisfied when:**
- Magnifying glass search icon appears in the nav header alongside the 7 category pills
- `/search` page loads with an autofocused text input
- Typing a query shows results grouped into Albums, Artists, and Tracks sections
- Each section header shows the result count (e.g., "Albums (3)")
- Album results show cover art thumbnail, title, artist name, and year
- Artist results show name, primary instrument, and album count
- Track results show track title, album title, and artist name
- Album results link to `/album/:slug`
- Artist results link to `/artist/:slug`
- Track results link to the parent album's `/album/:slug`
- Empty state (no query entered) shows instructional text
- No-results state shows a message when the query matches nothing
- Results appear within 100ms of typing (client-side substring matching)
- Search works across the full dataset (~3,300 albums, ~3,600 musicians, ~3,600 tracks)

## S13: Performant with Full Dataset
The app loads and navigates fluidly with 2,000+ albums. View switches are instant. Visualizations render without jank.

**Satisfied when:**
- Initial page load under 3 seconds
- Sub-view switches feel instant (no full-page reload)
- Search/filter results appear within 100ms
- D3 visualizations render within 1 second
- Total bundle size (excluding images) under 500KB

## S16: Responsive Nav on Narrow Screens
A user opens The Jazz Graph on a phone or narrow browser window (<=768px). The nav title sits on its own row, and the 7 category pills plus search icon wrap to a second row below. All pills are visible without horizontal scrolling. The user taps "Labels" and sees the Labels category with sub-nav. They rotate to landscape and the layout adjusts — pills may fit on fewer rows.

**Satisfied when:**
- At viewport width <=768px, the nav pills wrap below the title to one or more additional rows
- No horizontal scroll is required to access any category pill
- All 7 category pills and the magnifying glass search icon remain visible and tappable
- The search icon is a magnifying glass (not the word "Search")
- Sub-nav pills also remain accessible on narrow viewports
- Active category indication works the same as on desktop
- The wrapping breakpoint is 768px (standard tablet/phone threshold)
