# The Jazz Graph — Scenarios

## S1: Data Pipeline Produces Valid Dataset
A developer runs the data pipeline. It fetches album metadata, track listings, and cover art, then extracts dominant colors. The output is a JSON file containing 2,000+ albums.

**Satisfied when:**
- Pipeline scripts run to completion without errors
- Output JSON contains 2,000+ albums with complete metadata
- Each album has at least one musician in the lineup
- Albums have a `tracks` array with title, position, and duration for each track
- 50%+ of albums have a downloaded cover image with `dominantColor` HSL values
- Musician names are normalized (same person = same string across albums)

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
- Eras shows streamgraph with instrument family streams over decades
- Filter bar is present and functional
- Both panels render correctly with the full dataset

## S6: Artists Category
A user navigates to Artists. They see a radial bar chart of top artists. They switch to Network and see the force-directed collaboration graph. They switch to Careers and see career span bars.

**Satisfied when:**
- Overview shows radial bar chart of top artists by album count
- Network shows force-directed graph with zoom/pan/hover/click
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
A user navigates to Sound. They see track duration distributions. By Era shows how durations changed over decades. Track Counts shows tracks-per-album distribution.

**Satisfied when:**
- Durations shows histogram/violin plot of track lengths
- By Era shows average duration by decade
- Track Counts shows tracks-per-album distribution
- All panels handle albums without track data gracefully

## S9: Words Category
A user navigates to Words. They see a world map with place names from song/album titles. Mood shows emotional clusters. Vocabulary shows musical form word frequencies. Imagery shows time/nature references.

**Satisfied when:**
- Geography shows a dark-themed map with place name dots from titles
- Mood shows emotion categories clustered visually
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

## S13: Performant with Full Dataset
The app loads and navigates fluidly with 2,000+ albums. View switches are instant. Visualizations render without jank.

**Satisfied when:**
- Initial page load under 3 seconds
- Sub-view switches feel instant (no full-page reload)
- Search/filter results appear within 100ms
- D3 visualizations render within 1 second
- Total bundle size (excluding images) under 500KB
