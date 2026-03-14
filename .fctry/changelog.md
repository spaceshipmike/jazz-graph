# The Jazz Graph — Changelog

## 2026-03-13T19:42:00Z — /fctry:evolve (subgenres) [spec 0.13 → 0.14]
- Data / Source & Pipeline (2): Added `enrich-subgenres.mjs` to rebuild scripts; added Discogs + MB multi-source subgenre enrichment pipeline
- Data / Schema (2): Added `subgenres: string[]` and `discogsStyles: string[]` fields to Album
- Data / Subgenre Taxonomy (2): Added 15-subgenre canonical taxonomy with normalization map
- Data / Subgenre Shape System (2): Added geometric shape icon families (circle/triangle/diamond/square/hexagon) with stylistic lineage grouping
- Labels (3.4): Added subgenre shape pills to filter bar
- Time / Timeline (3.5): Added subgenre evolution markers (first/last appearance per style); added subgenre pills to filter bar
- Album Detail (3.8): Added subgenre badges (shape + name) to header metadata
- Artist Detail (3.9): Added subgenre badges showing stylistic range across discography
- Search (3.10): Added subgenre names as searchable field
- Design Tokens (5): Added subgenre shape rendering specs (inline SVG, sizing, color tokens)
- Future Enhancements (7): Removed "Genre/style tags from MusicBrainz" (now implemented)
- Synopsis: Updated to reflect subgenre taxonomy, shape system, and 3,300+ album count
- Scenario S17: Added subgenre enrichment and display scenario

## 2026-03-13T15:47:50Z — /fctry:evolve (responsive-nav, search-icon) [spec 0.11 → 0.12]
- Navigation Model (3): Replaced "Search" text link with magnifying glass search icon; added responsive wrapping behavior at <=768px
- `#search` (3.10): Updated nav behavior to reference search icon instead of "Search" text
- Navigation & Routing (4): Added responsive breakpoint description to primary nav bar
- Future Enhancements (7): Narrowed "Mobile-optimized layout" scope to visualization-specific work
- Scenario S15: Updated to reference magnifying glass icon instead of "Search" text
- Scenario S16: Added responsive nav scenario — pill wrapping, icon visibility, breakpoint validation

## 2026-03-13T14:33:14Z — /fctry:evolve (search) [spec 0.10 → 0.11]
- `#search` (3.10): Added global search view — dedicated page at `/search?q=...` with client-side substring matching across albums, artists, and tracks
- Navigation Model (3): Updated primary nav to include "Search" link alongside category pills
- Navigation & Routing (4): Added `/search` route to route table, updated nav bar description
- Scenario S15: Added global search scenario covering grouped results, detail linking, empty/no-results states, and 100ms performance
