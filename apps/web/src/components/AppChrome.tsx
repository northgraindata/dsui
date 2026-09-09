import { Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { Wordmark } from "./Wordmark";

const destinations = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/services", label: "Adapters", icon: "plug" },
  { to: "/activity", label: "Activity", icon: "activity" },
  { to: "/settings", label: "Settings", icon: "gear" },
];

export function AppChrome({
  pathname,
  openSearch,
}: {
  pathname: string;
  openSearch(): void;
}) {
  const inAdapter =
    pathname.startsWith("/services/") && pathname !== "/services/new";
  const [topbarHidden, setTopbarHidden] = useState(false);
  useEffect(() => {
    const onScroll = () => setTopbarHidden(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const navigation = destinations.map((item) => (
    <Link
      key={item.to}
      activeOptions={{ exact: true }}
      to={item.to}
      className="app-nav-link"
      aria-current={
        (item.to === "/" ? pathname === "/" : pathname.startsWith(item.to))
          ? "page"
          : undefined
      }
    >
      <Icon name={item.icon} />
      <span>{item.label}</span>
    </Link>
  ));
  return (
    <div className={`app-chrome ${inAdapter ? "app-chrome--adapter" : ""}`}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className={`app-topbar${topbarHidden ? " is-hidden" : ""}`}>
        <Wordmark />
        {inAdapter && (
          <nav aria-label="Main navigation" className="app-topnav">
            {navigation}
          </nav>
        )}
        <div className="app-topbar-actions">
          <button type="button" className="app-search" onClick={openSearch}>
            <Icon name="search" />
            <span>{inAdapter ? "Search…" : "Search anything…"}</span>
            <kbd>⌘ K</kbd>
          </button>
          <Link
            to="/settings"
            className="app-avatar"
            aria-label="Workspace settings"
          >
            DS
          </Link>
        </div>
      </header>
      <div className="app-body">
        {!inAdapter && (
          <aside className="app-sidebar">
            <nav aria-label="Main navigation">{navigation}</nav>
            <div className="app-sidebar-bottom">
              <div className="workspace-note">
                <Icon name="sparkle" />
                <span>Local workspace</span>
                <p>
                  Your data stack.
                  <br />
                  One lightweight interface.
                </p>
              </div>
              <Link to="/settings" className="workspace-profile">
                <span className="app-avatar">DS</span>
                <span>
                  My workspace<small>Manage settings</small>
                </span>
                <Icon name="chevron" />
              </Link>
            </div>
          </aside>
        )}
        <main id="main-content" className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
