# The Jazz Graph — Changelog

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
