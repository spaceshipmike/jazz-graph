import { BrowserRouter, Routes, Route, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback, createContext, useContext } from "react";
import { buildIndex } from "./data";
import { loadUserAlbums, addUserAlbum, removeUserAlbum, mergeAlbums } from "./userAlbums";
import "./tokens.css";

import Gallery from "./views/Gallery";
import AlbumDetail from "./views/AlbumDetail";
import ArtistDetail from "./views/ArtistDetail";
import Network from "./views/Network";
import Connections from "./views/Connections";
import Eras from "./views/Eras";
import Flow from "./views/Flow";

// Global data context
const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

export default function App() {
  const [canonicalAlbums, setCanonicalAlbums] = useState([]);
  const [userAlbums, setUserAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [artistPhotos, setArtistPhotos] = useState({});

  useEffect(() => {
    Promise.all([
      fetch("/data/albums.json").then((r) => r.ok ? r.json() : []),
      fetch("/data/artist-photos.json").then((r) => r.ok ? r.json() : {}).catch(() => ({})),
    ]).then(([albumData, photos]) => {
      setCanonicalAlbums(albumData);
      setUserAlbums(loadUserAlbums());
      setArtistPhotos(photos);
      setLoading(false);
    });
  }, []);

  const albums = useMemo(
    () => mergeAlbums(canonicalAlbums, userAlbums),
    [canonicalAlbums, userAlbums],
  );

  const index = useMemo(
    () => (albums.length > 0 ? buildIndex(albums) : null),
    [albums],
  );

  const handleAddAlbum = useCallback((album) => {
    setUserAlbums(addUserAlbum(album));
  }, []);

  const handleRemoveAlbum = useCallback((albumId) => {
    setUserAlbums(removeUserAlbum(albumId));
  }, []);

  if (loading) {
    return (
      <div style={{ background: "var(--bg)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="mono" style={{ color: "var(--fg-muted)", fontSize: 13 }}>Loading...</div>
      </div>
    );
  }

  return (
    <DataContext.Provider value={{ albums, index, artistPhotos, onAddAlbum: handleAddAlbum, onRemoveAlbum: handleRemoveAlbum }}>
      <BrowserRouter>
        <div className="grain" />
        <Nav />
        <Routes>
          <Route path="/" element={<Gallery />} />
          <Route path="/network" element={<Network />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/eras" element={<Eras />} />
          <Route path="/flow" element={<Flow />} />
          <Route path="/album/:slug" element={<AlbumDetail />} />
          <Route path="/artist/:slug" element={<ArtistDetail />} />
        </Routes>
      </BrowserRouter>
    </DataContext.Provider>
  );
}

function Nav() {
  const location = useLocation();
  const navigate = useNavigate();
  const isDetail = location.pathname.startsWith("/album/") || location.pathname.startsWith("/artist/");

  const links = [
    { to: "/", label: "Gallery" },
    { to: "/network", label: "Network" },
    { to: "/connections", label: "Connections" },
    { to: "/eras", label: "Eras" },
    { to: "/flow", label: "Flow" },
  ];

  return (
    <header style={{ padding: "20px var(--space-xl) 0", display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {isDetail && (
          <button
            onClick={() => navigate(-1)}
            className="mono"
            style={{ fontSize: 11, color: "var(--fg-muted)", letterSpacing: "0.05em", cursor: "pointer" }}
          >
            ← Back
          </button>
        )}
        <NavLink to="/" style={{ textDecoration: "none" }}>
          <p className="mono" style={{ fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--fg-muted)", margin: 0 }}>
            The Jazz Graph
          </p>
        </NavLink>
      </div>
      {!isDetail && (
        <nav style={{ display: "flex", gap: 4, marginBottom: 2 }}>
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className="mono"
              style={({ isActive }) => ({
                padding: "7px 18px",
                border: "1px solid",
                borderRadius: "var(--radius-pill)",
                borderColor: isActive ? "var(--fg)" : "var(--fg-ghost)",
                background: isActive ? "var(--fg)" : "transparent",
                color: isActive ? "var(--bg)" : "var(--fg-dim)",
                fontSize: 11,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                textDecoration: "none",
                transition: "var(--ease-default)",
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
