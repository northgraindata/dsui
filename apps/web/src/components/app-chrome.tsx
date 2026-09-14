import { Link, Outlet } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState } from "react";
import { Icon } from "./icon";
import { Wordmark } from "./wordmark";

const destinations = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/services", label: "Adapters", icon: "plug" },
  { to: "/settings", label: "Settings", icon: "gear" },
];

const AppChromeContext = createContext<{
  sidebarMerged: boolean;
  openSearch(): void;
}>({
  sidebarMerged: false,
  openSearch: () => undefined,
});

export function useAppChrome() {
  return useContext(AppChromeContext);
}

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
  const sidebarMerged = topbarHidden;

  useEffect(() => {
    const onScroll = (event?: Event) => {
      const target = event?.target;
      if (
        target instanceof HTMLElement &&
        target.closest(".adapter-main") &&
        target.scrollHeight > target.clientHeight
      ) {
        setTopbarHidden(target.scrollTop > 10);
        return;
      }
      setTopbarHidden(window.scrollY > 10);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("scroll", onScroll, true);
    };
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
    <AppChromeContext.Provider value={{ sidebarMerged, openSearch }}>
      <div className={`app-chrome${inAdapter ? " app-chrome--adapter" : ""}`}>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <header className={`app-topbar${sidebarMerged ? " is-hidden" : ""}`}>
          <Wordmark className="app-header-wordmark" />
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
              <div
                className={`app-sidebar-header${sidebarMerged ? " is-visible" : ""}`}
              >
                <Wordmark />
                <button
                  type="button"
                  className="app-sidebar-search"
                  onClick={openSearch}
                  aria-label="Search anything"
                  title="Search anything (Command K)"
                >
                  <Icon name="search" />
                </button>
              </div>
              <nav aria-label="Main navigation">{navigation}</nav>
            </aside>
          )}
          <main id="main-content" className="app-content">
            <Outlet />
          </main>
        </div>
      </div>
    </AppChromeContext.Provider>
  );
}
