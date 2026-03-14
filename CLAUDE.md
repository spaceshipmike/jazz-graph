# The Jazz Graph

Interactive visual encyclopedia of jazz — 2,200+ albums, real cover art, seven thematic visualization categories, 15-subgenre taxonomy with shape iconography, Blue Note-inspired dark aesthetic.

## Factory Contract

This project uses the factory spec model. The spec is the source of truth for what to build.

- **Spec:** `.fctry/spec.md` — read before implementing anything
- **Scenarios:** `.fctry/scenarios.md` — 17 end-to-end scenarios that define "done"
- **State:** `.fctry/state.json` — current workflow step and progress

If requirements shift, update the spec first (via `/fctry:evolve`), then implement.

## Commands

- `/fctry:execute` — assess state, propose build plan, implement from spec
- `/fctry:evolve <section>` — add features or modify the spec
- `/fctry:ref <url>` — incorporate external references
- `/fctry:review` — audit spec vs. codebase, find drift

## Project Structure

```
.fctry/              — spec, scenarios, config, references
data/                — pipeline output (gitignored images)
  artist-roster.json — curated artist list (source of truth for rebuild)
  albums.json        — 2,200+ albums with metadata + lineup + tracks + dominantColor + subgenres
  images/covers/     — album cover art JPGs
scripts/             — data pipeline scripts
  rebuild-library.mjs     — full rebuild from artist roster (--browse, --resume)
  filter-catalog.mjs      — filter catalog between browse and fetch phases
  fetch-spotify-covers.mjs    — Spotify 640px cover art (primary)
  fetch-covers.mjs            — Cover Art Archive fallback
  fetch-wikipedia-covers.mjs  — Wikipedia/Wikimedia Commons fallback
  spotify-upgrade-covers.mjs  — slow background Spotify upgrader (--batch, resumable)
  extract-colors.mjs          — dominant color extraction (HSL)
  clean-data.mjs           — instrument/label normalization
  fix-dates.mjs            — automated date correction
  fix-labels.mjs           — label corrections
  fix-leads.mjs            — leader instrument resolution
  add-artist.mjs           — interactive single-artist addition
  enrich-subgenres.mjs     — subgenre enrichment (Discogs + MusicBrainz, resumable)
  audit-library.mjs        — post-build quality audit (reissues, dates, lineup, tracks)
src/                 — application source
  App.jsx            — router, two-level nav, data context
  data.js            — instrument/label/family maps, buildIndex()
  tokens.css         — design tokens + reset
  components/FilterBar.jsx   — shared filter bar (family pills, label pills, artist autocomplete)
  components/CategoryPage.jsx — category layout with sub-nav tabs
  views/Color.jsx              — color mosaic home
  views/ArtistsCategory.jsx    — Artists: Overview, Network, Connections, Careers
  views/ArtistsConnections.jsx — Six Degrees of Jazz path finder
  views/ArtistsCareers.jsx     — career span chart
  views/InstrumentsCategory.jsx — Instruments: Overview, Eras
  views/LabelsCategory.jsx      — Labels: Overview, Browse, Flow
  views/TimeCategory.jsx        — Time: Timeline, Density, Ensembles
  views/SoundCategory.jsx       — Sound: Durations, By Era, Track Counts
  views/WordsCategory.jsx       — Words: Geography, Mood, Vocabulary, Imagery
  views/AlbumDetail.jsx
  views/ArtistDetail.jsx
```

## Key Decisions

- **Stack:** React + Vite + D3.js + React Router
- **Data:** Pre-fetched from MusicBrainz + Discogs + Spotify + Cover Art Archive, bundled as static JSON + images
- **Subgenres:** 15 canonical subgenres with geometric shape icon families (circle/triangle/diamond/square/hexagon) — filterable, searchable, shown on detail pages and timeline
- **Architecture:** Static SPA, no backend, client-side routing
- **Design:** Dark theme, Oswald Light + Source Serif 4 + SF Mono, instrument-family color system
- **Navigation:** Two-level — 7 category pills (Color, Artists, Instruments, Labels, Time, Sound, Words) + sub-nav tabs per category
- **Routing:** Path segments for sub-views (e.g., `/labels/flow`, `/instruments/eras`)
- **Detail pages:** Full pages for album/artist, not modals

## Compact Instructions

Preserve during auto-compaction:
- Spec path: `.fctry/spec.md`
- Scenario path: `.fctry/scenarios.md`
- State path: `.fctry/state.json`
- Current workflow step: check `state.json`
- Nav model: 7 categories with sub-nav tabs, path segment routing
- Categories: Color · Artists · Instruments · Labels · Time · Sound · Words
- Build order: data pipeline → nav scaffold → color → labels → instruments → artists → time → sound → words → polish
