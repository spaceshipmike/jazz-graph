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
    <header style={{ padding: "20px var(--space-xl) 0", display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
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
        <nav style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 2 }}>
          {CATEGORIES.map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
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
          <NavLink
            to="/about"
            className="mono"
            style={{
              padding: "7px 12px",
              fontSize: 11,
              color: "var(--fg-muted)",
              textDecoration: "none",
              marginLeft: 4,
              transition: "var(--ease-default)",
            }}
          >
            ?
          </NavLink>
        </nav>
      )}
    </header>
  );
}
