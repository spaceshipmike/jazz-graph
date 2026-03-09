import { NavLink, useLocation } from "react-router-dom";

/**
 * Shared layout for category pages with sub-nav tabs.
 *
 * tabs: [{ path: "/labels", label: "Overview" }, { path: "/labels/browse", label: "Browse" }, ...]
 * children: the active sub-view component
 */
export default function CategoryPage({ tabs, children }) {
  const location = useLocation();

  return (
    <div>
      {/* Sub-nav */}
      <div style={{
        display: "flex",
        gap: 3,
        padding: "16px var(--space-xl) 0",
        borderBottom: "1px solid var(--border)",
      }}>
        {tabs.map(({ path, label }) => {
          const isActive = location.pathname === path ||
            (path !== tabs[0].path && location.pathname.startsWith(path));
          // Default tab: active when at exact category root
          const isDefault = path === tabs[0].path && location.pathname === path;

          return (
            <NavLink
              key={path}
              to={path}
              end={path === tabs[0].path}
              className="mono"
              style={{
                padding: "7px 16px",
                fontSize: 10,
                fontWeight: (isActive || isDefault) ? 600 : 400,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                textDecoration: "none",
                color: (isActive || isDefault) ? "var(--fg)" : "var(--fg-muted)",
                borderBottom: (isActive || isDefault) ? "2px solid var(--fg)" : "2px solid transparent",
                marginBottom: -1,
                transition: "var(--ease-default)",
              }}
            >
              {label}
            </NavLink>
          );
        })}
      </div>

      {/* Active panel */}
      {children}
    </div>
  );
}
