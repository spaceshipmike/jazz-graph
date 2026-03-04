# The Jazz Graph

Interactive visual encyclopedia of jazz — 320+ canonical albums, real cover art, multiple data visualizations, Blue Note-inspired dark aesthetic.

## Factory Contract

This project uses the factory spec model. The spec is the source of truth for what to build.

- **Spec:** `.fctry/spec.md` — read before implementing anything
- **Scenarios:** `.fctry/scenarios.md` — 10 end-to-end scenarios that define "done"
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
  spec.md            — the specification
  scenarios.md       — scenario holdout set
  config.json        — version registry
  state.json         — workflow state
  references/        — visual references, design assets
scripts/             — data pipeline scripts
  fetch-data.mjs     — main MusicBrainz/Discogs pipeline
  fetch-covers.mjs   — cover art from Cover Art Archive
  clean-data.mjs     — instrument/label normalization
  fix-dates.mjs      — automated date correction via release groups
  fix-dates-manual.mjs — manual date corrections + compilation removal
  fix-labels.mjs     — original label lookup from MusicBrainz
  fix-labels-manual.mjs — manual label corrections for known albums
  fix-leads.mjs      — resolve group names to actual leader instruments
  seed-albums.json   — seed list of ~350 album titles
data/                — pipeline output (gitignored images)
  albums.json        — 320 albums with metadata + lineup
  images/covers/     — album cover art JPGs
  images/artists/    — artist photos (when available)
src/                 — application source
  App.jsx            — router, nav, data context
  data.js            — instrument/label maps, buildIndex()
  tokens.css         — design tokens + reset
  views/Gallery.jsx  — album grid with search/group/filter
  views/AlbumDetail.jsx
  views/ArtistDetail.jsx — includes D3 timeline
  views/Network.jsx  — force-directed musician-album graph
  views/Connections.jsx — force-directed album similarity graph
jazz-connections.jsx — original prototype (dead code, safe to remove)
```

## Key Decisions

- **Stack:** React + Vite + D3.js + React Router
- **Data:** Pre-fetched from MusicBrainz + Cover Art Archive, bundled as static JSON + images
- **Architecture:** Static SPA, no backend, client-side routing
- **Design:** Dark theme, Playfair Display + JetBrains Mono, instrument-family color system
- **Views:** Gallery (home), Network Graph, Artist Timelines, Album Connections
- **Navigation:** Full pages for album/artist detail, not modals

## Compact Instructions

Preserve during auto-compaction:
- Spec path: `.fctry/spec.md`
- Scenario path: `.fctry/scenarios.md`
- State path: `.fctry/state.json`
- Current workflow step: check `state.json`
- Build order: data pipeline → scaffold → gallery → album pages → artist pages → network → connections → polish
