import type { PluginCatalog } from "@northgraindata/dsui-plugin-sdk";
import { Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getPluginCatalog } from "../api";
import {
  PluginShellActions,
  PluginSlot,
  usePluginSlotBatch,
} from "../features/plugins/plugin-slots";
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
  const profile = usePluginSlotBatch("sidebar.profile");
  const inAdapter =
    pathname.startsWith("/services/") && pathname !== "/services/new";
  const [topbarHidden, setTopbarHidden] = useState(false);
  const [pluginNavigation, setPluginNavigation] = useState<
    PluginCatalog["navigation"]
  >([]);
  useEffect(() => {
    const onScroll = () => setTopbarHidden(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Route changes refresh permission-dependent plugin navigation.
  useEffect(() => {
    let active = true;
    let retryTimer: number | undefined;

    const loadPluginNavigation = async (retry = true) => {
      try {
        const catalog = await getPluginCatalog();
        if (active) setPluginNavigation(catalog.navigation);
      } catch {
        if (!active) return;
        // The API can still be starting while the web app is already open.
        // Keep the last good navigation and retry once the server is ready.
        if (retry)
          retryTimer = window.setTimeout(
            () => loadPluginNavigation(false),
            1500,
          );
      }
    };

    const refresh = () => {
      if (document.visibilityState === "visible") void loadPluginNavigation();
    };

    void loadPluginNavigation();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pathname]);
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
        <PluginShellActions />
        <PluginShellActions />
      </header>
      <div className="app-body">
        {!inAdapter && (
          <aside className="app-sidebar">
            <nav aria-label="Main navigation">{navigation}</nav>
            {pluginNavigation.length > 0 && (
              <nav aria-label="Extensions">
                {pluginNavigation.map((item) => (
                  <Link
                    key={`${item.pluginId}/${item.id}`}
                    to="/plugins/$pluginId/$"
                    params={{ pluginId: item.pluginId, _splat: item.pageId }}
                    className="app-nav-link"
                    aria-current={
                      pathname === `/plugins/${item.pluginId}/${item.pageId}`
                        ? "page"
                        : undefined
                    }
                  >
                    <Icon name="plug" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </nav>
            )}
            <div className="app-sidebar-bottom">
              <a
                className="sidebar-star-banner"
                href="https://github.com/northgraindata/dsui"
                target="_blank"
                rel="noreferrer"
              >
                <span className="sidebar-star-banner__copy">
                  <strong>Leave a star ⭐</strong>
                  <span>Help DSUI reach more builders.</span>
                </span>
                <Icon name="chevron" size={14} />
              </a>
              <PluginSlot
                serviceId=""
                results={profile.results}
                error={profile.error}
                fallback={
                  <Link to="/settings" className="workspace-profile">
                    <span>
                      My workspace<small>Manage settings</small>
                    </span>
                    <Icon name="chevron" />
                  </Link>
                }
              />
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
