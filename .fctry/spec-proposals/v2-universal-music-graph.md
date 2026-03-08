# The Music Graph — v2 Spec Proposal

## Vision

The Jazz Graph becomes The Music Graph — a universal music collection visualizer that works with any library source and any genre. Your personal music collection, visualized through the same seven data dimensions, with genre-specific instrument taxonomies and visual identities.

The core proposition shifts from "curated jazz encyclopedia" to "plug in your collection, see its hidden structure."

## Architecture

### Three-Layer Model

```
┌─────────────────────────────────────────┐
│              Visualizer                  │  React + D3 (mostly unchanged)
│  Color · Artists · Instruments · Labels  │
│  Time · Sound · Words                    │
├─────────────────────────────────────────┤
│              Enricher                    │  MusicBrainz metadata + covers
│  lineup · instruments · labels · tracks  │
├─────────────────────────────────────────┤
│             Connectors                   │  One per source
│  Spotify · Navidrome · Apple Music · ... │
└─────────────────────────────────────────┘
```

Data flows bottom-up. Connectors produce a normalized album list. The Enricher adds MusicBrainz metadata. The Visualizer consumes the same `albums.json` format it does today.

### Connector Interface

Every connector produces an array of:

```
ConnectorAlbum {
  title: string
  artist: string
  year: number | null
  sourceId: string         // spotify:album:xyz, subsonic:al-123, etc.
  mbid: string | null      // if the source provides MusicBrainz IDs
  owned: boolean           // in user's library
  playCount: number | null // listening history
  favorite: boolean        // user-flagged
  genres: string[]         // source-provided genre tags
  coverUrl: string | null  // source cover art URL
}
```

### Connectors

#### Spotify
- OAuth 2.0 PKCE flow (client-side, no backend needed)
- `GET /me/albums` — saved albums (owned)
- `GET /me/top/artists` + `GET /artists/{id}/albums` — listening-based discovery
- `GET /me/player/recently-played` — play history
- Rich genre tags from Spotify's taxonomy
- 640px cover art included

#### Navidrome / Subsonic
- Subsonic API with token auth
- `getArtists` + `getAlbumList2` — full library scan
- `getStarred2` — favorites
- MusicBrainz IDs available if files are properly tagged
- Cover art via `getCoverArt`

#### Apple Music
- MusicKit JS with developer token
- `GET /me/library/albums` — user's library
- `GET /me/recent/played` — listening history
- Limited genre data

#### Last.fm
- API key auth (no OAuth needed for public data)
- `user.getTopAlbums` — listening history with play counts
- `user.getRecentTracks` — recent activity
- No ownership data — purely listening-based
- Good for "what do I actually listen to" vs. "what do I own"

#### Discogs
- OAuth 1.0a
- `GET /users/{username}/collection` — physical collection
- Already has MusicBrainz release IDs in many cases
- Vinyl/CD/cassette format metadata

#### CSV / Manual
- Upload a CSV with artist, title, year columns
- Fallback for any unsupported source
- Template CSV provided

### Enricher

The enricher takes connector output and produces full `albums.json` entries:

1. **Match** — Find each album in MusicBrainz by MBID, title+artist fuzzy match, or Spotify/Discogs ID crossref
2. **Fetch lineup** — Session musicians with instruments from MB release relations
3. **Fetch tracks** — Track listings with durations from MB recordings
4. **Cover art** — Use connector's cover URL, fall back to Spotify API, then Cover Art Archive
5. **Color extraction** — Dominant HSL from cover image
6. **Genre assignment** — Merge source genre tags with MusicBrainz tags, map to graph genres
7. **Post-processing** — Instrument normalization, label correction, lead resolution

The enricher is the current `rebuild-library.mjs` generalized — instead of starting from an artist roster, it starts from connector output.

Rate limiting: MusicBrainz 1 req/sec, Spotify 30 req/sec, enrichment is the bottleneck. A 2,000 album library takes ~2 hours to fully enrich. Progress saving and resume supported.

## Genre System

### Genre Detection

Albums are assigned to one or more graph genres based on:
1. Source genre tags (Spotify, Last.fm, Discogs)
2. MusicBrainz genre/style tags
3. Label associations (Blue Note -> jazz, Motown -> soul, etc.)
4. Manual override in a user config file

### Genre Graphs

Each genre gets its own instrument taxonomy, color palette, and optional visual identity:

```
GenreConfig {
  id: string              // "jazz", "soul", "classical", "electronic"
  name: string
  instrumentFamilies: {
    [family: string]: {
      color: string
      instruments: string[]
    }
  }
  labelColors: {
    [label: string]: string
  }
  theme: string | null    // optional CSS theme override
}
```

#### Built-in Genre Configs

**Jazz** (ships with v1)
- Families: brass, reeds, keys, rhythm, strings, mallets, vocals
- Labels: Blue Note, Prestige, Impulse!, Riverside, etc.
- Theme: Blue Note / Reid Miles dark aesthetic

**Soul / Funk / R&B**
- Families: vocals, horns, keys, guitar, rhythm, strings (orchestral)
- Labels: Motown, Stax, Atlantic, Philadelphia International, Hi Records
- Theme: warm, Motown-inspired palette

**Hip-Hop**
- Families: vocals/MC, production, DJ, live instruments
- Labels: Def Jam, Death Row, Bad Boy, Stones Throw, Rhymesayers
- Theme: bold, high-contrast

**Electronic**
- Families: synth, drum machine, sampler, sequencer, vocals, live instruments
- Labels: Warp, Ninja Tune, Kompakt, Hyperdub, R&S
- Theme: grid/matrix aesthetic

**Classical**
- Families: strings, woodwinds, brass, percussion, keyboard, voice
- Labels: Deutsche Grammophon, Decca, ECM, Nonesuch
- Theme: typographic, restrained

**Rock**
- Families: guitar, bass, drums, keys, vocals
- Labels: by era/subgenre
- Theme: TBD

Users can create custom genre configs for niche collections.

### Cross-Genre View

A top-level view that shows all genres together:
- Network graph with genre as a color dimension — see musicians who cross boundaries
- Timeline showing genre distribution over decades in your collection
- "Six degrees" path-finder that crosses genre lines

## Influence Graph

### Data Sources

Two open-data sources provide directional artist-to-artist influence relationships:

**MusicBrainz** — Artist relationships include "influenced by" type. Available via `artist-rels` include parameter. Coverage is uneven but solid for canonical artists.

**Wikidata** — Property `P737` ("influenced by") on artist entities. Queryable via SPARQL. Often better coverage than MusicBrainz for notable musicians. Example: Miles Davis's entry lists Charlie Parker, Duke Ellington, Ahmad Jamal as influences.

Both are fetched during enrichment and merged (deduplicated by artist name/MBID).

### Data Model

```
ArtistInfluence {
  artist: string          // the artist
  artistMbid: string
  influencedBy: string[]  // artists who influenced them
  influenced: string[]    // artists they influenced
  sources: string[]       // ["musicbrainz", "wikidata"]
}
```

Stored as `data/influences.json` alongside `albums.json`. Linked to the artist index at runtime.

### Enrichment Script

```
node scripts/fetch-influences.mjs    # MusicBrainz + Wikidata influence data
```

Fetches influence relationships for all artists in the dataset. MusicBrainz rate-limited at 1 req/sec, Wikidata SPARQL is fast (batch query for all artists at once).

### Visualizations

**Influence Tree** (`/artists/influences`) — New sub-view in Artists category. A directed graph where edges flow from influence → artist → influenced. Nodes colored by instrument family or genre. Click any node to recenter the tree on that artist. Reveals lineage chains: Bird → Coltrane → Pharoah Sanders → Kamasi Washington.

**Generational Layer** — Overlay on the Careers view. Influence arrows drawn between career span bars, showing how earlier artists fed into later ones. Makes generational handoffs visible — bebop to hard bop to free jazz as a living flow rather than genre labels.

**Influence Reach** — On Artist Detail pages, a section showing "Influenced by" and "Influenced" with links. Combined with the collaboration network, reveals whether influence correlates with direct collaboration (often it does — sidemen become leaders who cite their bandleaders).

**Recommendation dimension** — "You own 15 albums by artists all influenced by Art Blakey. Here are 5 more from that influence tree you don't own." The influence graph becomes a powerful recommendation signal — stronger than "similar sounding" because it reflects real artistic lineage.

### Cross-Genre Influence

Influence often crosses genre boundaries. Miles Davis influenced hip-hop producers. James Brown influenced funk, hip-hop, and electronic music. The influence graph in cross-genre view shows these bridges — potentially the most interesting visualization in the entire app, revealing how genres aren't islands but a connected web of ideas.

## Data Model Changes

### Extended Album Schema

```
Album {
  // ... existing fields from v1 ...

  // v2 additions
  source: string              // "spotify", "navidrome", "roster", etc.
  sourceId: string | null
  owned: boolean              // in user's library (true for roster-sourced)
  playCount: number | null
  favorite: boolean
  genres: string[]            // ["jazz", "soul"]
  primaryGenre: string        // for graph assignment
}
```

### User Config

```
data/user-config.json {
  connectors: [
    { type: "spotify", enabled: true },
    { type: "navidrome", url: "...", enabled: true }
  ],
  genreOverrides: {
    "miles-davis-bitches-brew": ["jazz", "funk"]  // manual genre assignment
  },
  activeGenres: ["jazz", "soul", "funk"],  // which graphs to generate
  enrichment: {
    fetchLineups: true,
    fetchTracks: true,
    fetchCovers: true
  }
}
```

## Visualizer Changes

### Navigation

```
[Genre Switcher] [Color · Artists · Instruments · Labels · Time · Sound · Words]
                 [Sub-nav tabs]
```

Top-level genre switcher (pill row or dropdown) above the existing category nav. "All" option shows cross-genre view. Each genre switch refilters the dataset and swaps the instrument taxonomy + label colors.

### New Data Dimensions

**Ownership overlay** — Every view can toggle between "my collection" and "full graph." In collection mode, unowned albums appear ghosted/dimmed. The gap between what you have and what exists becomes a visual recommendation.

**Listening intensity** — Play count maps to visual weight. In the color mosaic, frequently-played albums glow brighter. In the network, high-play-count nodes are larger. The timeline shows "actually listened to" vs. "own but never played."

**Favorites** — Starred albums get a visual accent across all views.

### Recommendation Surfaces

Recommendations emerge naturally from the data rather than being a separate feature:

- **Network gaps** — "You have 8 albums featuring Ron Carter but none where he leads. Here are his 5 most-connected leader albums."
- **Label coverage** — "You own 30 Blue Note albums from 1955-1965 but only 2 from 1965-1970. Here's what you're missing from that era."
- **Collaborator discovery** — "Bobby Hutcherson appears on 6 albums you own. His leader albums might interest you."
- **Genre bridges** — "These 3 albums in your jazz collection also tagged as funk — explore more funk?"

These are surfaced as contextual suggestions in existing views, not a dedicated recommendations page.

## Deployment Models

### Local (current)
- Static SPA, data pre-built
- `npm run sync` pulls from connectors, enriches, builds
- Good for personal use, Navidrome users, privacy-conscious

### Hosted (future possibility)
- User authorizes Spotify/Apple Music
- Pipeline runs server-side
- Each user gets a unique graph URL
- No library data stored — computed on demand or cached ephemerally
- This is a product

## Migration Path from v1

v1 (The Jazz Graph) becomes a preset — a curated jazz collection that ships as the default dataset. Users who don't connect any source still get the full jazz encyclopedia experience.

The roster-based pipeline becomes one connector among many: the "curated roster" connector.

```
v1: roster.json → rebuild-library.mjs → albums.json → visualizer
v2: connector(s) → enrich.mjs → albums.json → visualizer
    roster.json is just another connector
```

## Build Order

1. **Connector interface** — Define the normalized format, build the enricher as a refactor of rebuild-library.mjs
2. **Navidrome connector** — First real connector (you can test against your own library)
3. **Genre system** — Genre configs, instrument taxonomy per genre, genre switcher in nav
4. **Ownership overlay** — owned/unowned visual treatment across all views
5. **Spotify connector** — OAuth flow, saved albums, play history
6. **Listening dimensions** — Play count as visual weight, favorites accent
7. **Recommendation surfaces** — Contextual suggestions in existing views
8. **Influence graph** — MusicBrainz + Wikidata influence data, influence tree view, generational overlay
9. **Additional connectors** — Apple Music, Last.fm, Discogs, CSV
10. **Cross-genre view** — Multi-genre network, genre-crossing paths, cross-genre influence bridges

## Decisions

1. **Naming** — New name TBD. Not "The Jazz Graph" — needs a name that encompasses all genres. Jazz Graph becomes the first "preset" or demo instance.
2. **Hosted vs local** — Build local-first, evaluate SaaS potential after seeing it work. No premature infrastructure.
3. **Genre granularity** — Two-tier: master genres and sub-genres. Example: Reggae (master) contains rocksteady, ska, roots, dub (sub-genres). Jazz contains bebop, hard bop, free jazz, fusion, soul jazz, etc. Sub-genres inherit the master genre's instrument taxonomy but can override. Views can filter at either level.
4. **First connector** — Navidrome. Test against Mike's own library before building OAuth flows.
5. **Enrichment** — Fast mode skips MusicBrainz lineup data for speed. But research other enrichment sources beyond MB — Discogs has production credits, Spotify has audio features (tempo, energy, danceability), Last.fm has listener-generated tags. These could power new visualization dimensions.

## Open Questions

1. **What's the name?**
2. **Enrichment sources** — What data beyond MusicBrainz is worth fetching? Spotify audio features? Discogs production credits? Last.fm tags? Rate.fm ratings? Need to research what's available and what would power interesting visualizations.
3. **Cross-source dedup** — User has the same album on Spotify and Navidrome. Merge play counts? Show both sources?
4. **Sub-genre assignment** — Automated (from tags) or manual? Automated will be noisy. Manual doesn't scale.
5. **Genre-specific visualizations** — Do some genres warrant unique view types that don't exist in the jazz version? e.g., electronic music might want a BPM distribution view that jazz doesn't need.
