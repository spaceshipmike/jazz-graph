# The Jazz Graph — Scenarios

## S1: Data Pipeline Produces Valid Dataset
A developer runs the data pipeline script. It fetches album data from MusicBrainz, cover art from Discogs, and outputs a JSON file containing 320+ albums. Each album has: title, artist, year, label, cover image path, and a lineup array where each musician has name, instrument(s), and lead status. Cover images are downloaded to a local assets directory. The script reports how many albums were fetched, how many covers were found, and any gaps.

**Satisfied when:**
- Script runs to completion without errors
- Output JSON contains 300+ albums with complete metadata
- 90%+ of albums have a downloaded cover image
- Each album has at least one musician in the lineup
- Musician names are normalized (same person = same string across albums)

## S2: Album Gallery Loads with Real Covers
A user opens The Jazz Graph. They see a grid of album cards with real cover art, album title, artist name, year, and label. The gallery loads within 2 seconds. Cards are visually polished — the Blue Note aesthetic is evident in typography, spacing, and color.

**Satisfied when:**
- Gallery renders 50+ albums on initial load (paginated or virtualized for full set)
- Real cover images display (not generative SVGs)
- Cards show title, artist, year, label
- Dark theme with serif + monospace typography is applied
- No layout shift as images load (aspect ratios reserved)

## S3: Gallery Filtering and Grouping
A user searches for "Coltrane" and sees only albums featuring John Coltrane (as leader or sideman). They clear the search and group by decade — albums organize into 1950s, 1960s, 1970s sections. They click an instrument filter pill for "tenor sax" and the gallery shows only albums with a tenor saxophonist.

**Satisfied when:**
- Search filters by album title, artist name, musician name, instrument, and label
- Group-by options include: label, decade, leader, lead instrument
- Instrument filter is toggleable and visually indicates active state
- Filters compose (search + instrument filter work together)
- Results update immediately (no perceptible delay)

## S4: Album Detail Page
A user clicks an album card in the gallery. They navigate to a full page (not a modal) showing: large cover art, album title, artist, year, label, and the complete lineup. Each musician in the lineup shows their instrument and whether they were the leader. Clicking a musician name navigates to that artist's page.

**Satisfied when:**
- URL changes to a distinct route (e.g., /album/kind-of-blue)
- Page shows cover art at a prominent size
- Full lineup is displayed with instrument and lead status
- Musician names are clickable links to artist pages
- Browser back button returns to previous view
- Page loads directly from URL (bookmarkable)

## S5: Artist Detail Page with Timeline
A user navigates to an artist page (e.g., Herbie Hancock). They see: artist name, photo (if available), primary instrument(s), and a horizontal timeline showing every album they appear on. Albums where they're the leader are visually distinct from sideman appearances. The timeline conveys their career arc at a glance.

**Satisfied when:**
- URL changes to a distinct route (e.g., /artist/herbie-hancock)
- Artist name and instrument(s) displayed prominently
- Horizontal timeline shows albums positioned by year
- Leader vs. sideman appearances are visually differentiated
- Clicking an album on the timeline navigates to that album's page
- Top collaborators are listed with shared-album counts

## S6: Network Graph — Polished
A user switches to the Network view. They see a force-directed graph connecting musicians and albums. The graph is zoomable and pannable. Hovering a node highlights its connections and dims unrelated nodes. Instrument colors are consistent with the rest of the app. The graph feels smooth (60fps during interaction). Clicking a node navigates to that album or artist page.

**Satisfied when:**
- Force layout renders without janky initial settling
- Zoom and pan are smooth (trackpad and mouse)
- Hover highlights connected nodes and edges, dims others
- Instrument color legend is present and interactive (click to filter)
- Node click navigates to the full detail page
- Graph handles 320+ albums + musicians without performance issues

## S7: Album Connections View
A user switches to the Album Connections view. They can toggle between two visualizations: a chord diagram (albums arranged in a circle with ribbons connecting shared-personnel pairs) and an arc diagram (albums on a timeline with arcs showing connections). Thicker connections indicate more shared personnel. They can hover to see which musicians two albums share. Clicking navigates to the relevant album page.

**Satisfied when:**
- Visualization clearly shows album-to-album connections
- Connection strength maps to number of shared musicians
- Hover reveals the specific shared musicians
- Clicking an album navigates to its detail page
- The visualization is readable with 50+ albums visible at once
- A filtering mechanism limits the view when the full dataset is too dense

## S8: Consistent Visual Design System
Across all views and pages, the design feels cohesive. Dark background, consistent color palette (instrument colors, label colors), consistent typography (bold serif for headings, monospace for metadata), consistent spacing and component patterns. The Blue Note / Reid Miles inspiration is evident but not pastiche.

**Satisfied when:**
- A single design token system (colors, typography, spacing) is used across all views
- Instrument colors are identical everywhere they appear
- Typography hierarchy is consistent (headings, body, metadata, labels)
- Interactive elements (buttons, pills, cards) share consistent patterns
- Transitions and animations are subtle and consistent
- Dark theme has sufficient contrast for readability

## S9: Performant with Full Dataset
The app loads and navigates fluidly with the full 320+ album dataset. Gallery scrolling is smooth. View switches are instant. Network graph interaction stays at 60fps. No visible jank during filtering or searching.

**Satisfied when:**
- Initial page load under 3 seconds on broadband
- Gallery scrolling is smooth (virtualized if needed for full dataset)
- Search/filter results appear within 100ms
- View transitions complete within 300ms
- Network graph maintains 60fps during drag/zoom with full dataset
- Total bundle size (excluding images) under 500KB

## S10: Routing and Navigation
The app has proper client-side routing. The URL reflects the current view and selected item. Users can bookmark any page and return to it. The browser back button works correctly throughout. Navigation between views preserves filter state where sensible.

**Satisfied when:**
- Routes exist for: home/gallery, network, connections, album detail, artist detail
- Direct URL access works for all routes
- Browser back/forward navigation works correctly
- Active view is indicated in the navigation
- Search/filter state is preserved when navigating back to gallery

## S11: User Adds an Album via MusicBrainz Lookup
A user clicks "Add Album" in the Gallery header. A form appears where they type an album title and artist name. They click "Search" and the app queries MusicBrainz client-side, returning matching releases. The user picks the correct one and sees a preview: title, artist, year, label, lineup with instruments. They confirm, and the album immediately appears in the gallery and is available across all views (network, connections, eras, flow, etc.). The addition persists across page reloads via localStorage. A badge or indicator distinguishes user-added albums from the canonical set.

**Satisfied when:**
- "Add Album" button is visible in the Gallery header
- Form accepts album title and artist name
- MusicBrainz search returns results within 3 seconds
- User can preview full album metadata before confirming
- Confirmed album appears in the gallery immediately without page reload
- Album persists across browser sessions (localStorage)
- User-added albums appear in all visualization views (network, connections, eras, flow)
- User can remove their additions
- A visual indicator distinguishes user-added albums from canonical ones

## S12: User Submits Album for Permanent Inclusion
After adding an album locally, a user sees a "Submit to project" option. Clicking it opens a pre-filled GitHub Issue with the album's JSON data (title, artist, MusicBrainz ID). The issue provides enough information for the maintainer to review and merge the album into the canonical dataset.

**Satisfied when:**
- "Submit to project" action is available for user-added albums
- Clicking opens a new GitHub Issue in the project repo
- Issue body contains structured album data (title, artist, MBID, year, label)
- Issue is pre-filled and ready to submit (user just clicks "Submit new issue" on GitHub)
- The flow does not require the user to have any technical knowledge
