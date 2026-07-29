# Architecture Decision Record — jazz-graph

## Overview
Interactive visual encyclopedia of jazz — 2,200+ albums with real cover art, seven thematic visualization categories, 15-subgenre taxonomy with shape iconography, Blue Note-inspired dark aesthetic.

## Stack
- **Framework:** React 18 + Vite (static SPA, no backend)
- **Visualization:** D3.js for all charts/graphs (force layouts, streamgraphs, Sankey, treemaps, circle packs, bar charts)
- **Routing:** React Router with two-level navigation — 7 category pills + sub-nav tabs per category
- **Styling:** CSS custom properties (tokens.css), dark theme, Oswald Light + Source Serif 4 + SF Mono

## Data Architecture
- Pre-fetched static JSON (`data/albums.json`) with 2,200+ albums including metadata, lineup, tracks, dominant color, subgenres
- Data pipeline scripts (`scripts/`) fetch from MusicBrainz, Discogs, Spotify, Cover Art Archive, Wikipedia
- Album cover images stored locally as WebP (`data/images/covers/`)
- No runtime API calls — fully static client-side app

## Navigation Model
Seven categories with sub-views via path segments:
- **Color** — CIELAB-sorted mosaic
- **Artists** — overview, network graph, connections (six degrees), careers
- **Instruments** — overview, eras streamgraph
- **Labels** — overview, gallery browse, label flow Sankey
- **Time** — timeline, density, ensembles
- **Sound** — combos Sankey, durations, by-era heatmap, track counts
- **Words** — geography, mood, vocabulary, imagery

## Key Modules
- `src/data.js` — instrument/label/family maps, buildIndex() for search
- `src/subgenres.js` — 15-subgenre taxonomy with SVG shape definitions (circle/triangle/diamond/square/hexagon families)
- `src/titleAnalysis.js` — NLP extraction of place/mood/imagery from album titles
- `src/components/FilterBar.jsx` — shared filter bar (family pills, label pills, artist autocomplete, subgenre shapes)

## Data Pipeline (scripts/)
Multi-source enrichment pipeline:
1. `rebuild-library.mjs` — full rebuild from artist roster (MusicBrainz browse)
2. `filter-catalog.mjs` → `fetch-tracks.mjs` → cover art fetchers (Spotify primary, CAA fallback, Wikipedia fallback)
3. `extract-colors.mjs` — CIELAB + OKLCH dominant color extraction
4. `enrich-subgenres.mjs` — Discogs styles + MusicBrainz genres → 15 canonical subgenres
5. `clean-data.mjs` / `fix-*.mjs` — normalization and correction passes
6. `audit-library.mjs` — post-build quality audit

## Design Decisions
- **Static over dynamic:** All data pre-computed, no backend needed — optimizes for reliability and deployment simplicity
- **D3 over charting libraries:** Direct D3 manipulation for full control over bespoke jazz-specific visualizations
- **Subgenre shapes over colors:** Geometric shapes communicate stylistic lineage without conflicting with the instrument-family color system
- **Canvas for network graph:** Force-directed collaboration graph uses canvas rendering for performance with thousands of nodes
- **CIELAB color sorting:** Perceptually uniform color space for the mosaic view produces visually pleasing gradients