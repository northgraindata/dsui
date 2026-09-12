import { Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { Wordmark } from "./wordmark";

const destinations = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/services", label: "Adapters", icon: "plug" },
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
        <div className="app-topbar-search">
          <button type="button" className="app-search" onClick={openSearch}>
            <Icon name="search" />
            <span>Search anything…</span>
            <kbd>⌘ K</kbd>
          </button>
        </div>
      </header>
      <div className="app-body">
        {!inAdapter && (
          <aside className="app-sidebar">
            <nav aria-label="Main navigation">{navigation}</nav>
            <div className="app-sidebar-bottom">
              <a
                className="sidebar-star-banner"
                href="https://github.com/northgraindata/dsui"
                target="_blank"
                rel="noreferrer"
              >
                <span className="sidebar-star-banner__copy">
                  <strong>Leave a star ⭐</strong>
                  <span>Help dsui reach more builders.</span>
                </span>
                <Icon name="chevron" size={14} />
              </a>
              <Link to="/settings" className="workspace-profile">
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
