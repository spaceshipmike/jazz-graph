# The Jazz Graph — Changelog

## 2026-03-13T14:33:14Z — /fctry:evolve (search) [spec 0.10 → 0.11]
- `#search` (3.10): Added global search view — dedicated page at `/search?q=...` with client-side substring matching across albums, artists, and tracks
- Navigation Model (3): Updated primary nav to include "Search" link alongside category pills
- Navigation & Routing (4): Added `/search` route to route table, updated nav bar description
- Scenario S15: Added global search scenario covering grouped results, detail linking, empty/no-results states, and 100ms performance
