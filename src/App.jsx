import { BrowserRouter, Routes, Route, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, createContext, useContext } from "react";
import { buildIndex } from "./data";
import "./tokens.css";

import Color from "./views/Color";
import ArtistsCategory from "./views/ArtistsCategory";
import InstrumentsCategory from "./views/InstrumentsCategory";
import LabelsCategory from "./views/LabelsCategory";
import TimeCategory from "./views/TimeCategory";
import SoundCategory from "./views/SoundCategory";
import WordsCategory from "./views/WordsCategory";
import AlbumDetail from "./views/AlbumDetail";
import ArtistDetail from "./views/ArtistDetail";
import About from "./views/About";
import Search from "./views/Search";

// Global data context
const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

export default function App() {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [artistPhotos, setArtistPhotos] = useState({});

  useEffect(() => {
    Promise.all([
      fetch("/data/albums.json").then((r) => r.ok ? r.json() : []),
      fetch("/data/artist-photos.json").then((r) => r.ok ? r.json() : {}).catch(() => ({})),
    ]).then(([albumData, photos]) => {
      setAlbums(albumData);
      setArtistPhotos(photos);
      setLoading(false);
    });
  }, []);

  const index = useMemo(
    () => (albums.length > 0 ? buildIndex(albums) : null),
    [albums],
  );

  if (loading) {
    return (
      <div style={{ background: "var(--bg)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="mono" style={{ color: "var(--fg-muted)", fontSize: 13 }}>Loading...</div>
      </div>
    );
  }

  return (
    <DataContext.Provider value={{ albums, index, artistPhotos }}>
      <BrowserRouter>
        <div className="grain" />
        <Nav />
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Color />} />
          <Route path="/artists/*" element={<ArtistsCategory />} />
          <Route path="/instruments/*" element={<InstrumentsCategory />} />
          <Route path="/labels/*" element={<LabelsCategory />} />
          <Route path="/time/*" element={<TimeCategory />} />
          <Route path="/sound/*" element={<SoundCategory />} />
          <Route path="/words/*" element={<WordsCategory />} />
          <Route path="/album/:slug" element={<AlbumDetail />} />
          <Route path="/artist/:slug" element={<ArtistDetail />} />
          <Route path="/search" element={<Search />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </BrowserRouter>
    </DataContext.Provider>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

const CATEGORIES = [
  { to: "/", label: "Color", exact: true },
  { to: "/artists", label: "Artists" },
  { to: "/instruments", label: "Instruments" },
  { to: "/labels", label: "Labels" },
  { to: "/time", label: "Time" },
  { to: "/sound", label: "Sound" },
  { to: "/words", label: "Words" },
];

function Nav() {
  const location = useLocation();
  const navigate = useNavigate();
  const isDetail = location.pathname.startsWith("/album/") || location.pathname.startsWith("/artist/");

  const isAbout = location.pathname === "/about";

  return (
    <header className="site-header">
      <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
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
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: 38,
            fontWeight: 300,
            letterSpacing: "-0.01em",
            color: "var(--fg)",
            margin: 0,
            lineHeight: 1,
          }}>
            The Jazz Graph
          </h1>
        </NavLink>
      </div>
      {!isDetail && (
        <nav className="site-nav">
          {CATEGORIES.map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className="mono nav-pill"
              style={({ isActive }) => ({
                borderColor: isActive ? "var(--fg)" : "var(--fg-ghost)",
                background: isActive ? "var(--fg)" : "transparent",
                color: isActive ? "var(--bg)" : "var(--fg-dim)",
              })}
            >
              {label}
            </NavLink>
          ))}
          <NavLink
            to="/search"
            className="nav-icon"
            style={({ isActive }) => ({
              color: isActive ? "var(--fg)" : "var(--fg-muted)",
            })}
            aria-label="Search"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </NavLink>
          <NavLink
            to="/about"
            className="mono nav-icon"
            style={{ color: "var(--fg-muted)" }}
          >
            ?
          </NavLink>
        </nav>
      )}
    </header>
  );
}
