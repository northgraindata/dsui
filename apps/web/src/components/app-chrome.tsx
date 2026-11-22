import type { PluginCatalog } from "@northgraindata/dsui-plugin-sdk";
import { Link, Outlet } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getPluginCatalog } from "../api";
import { groupPluginNavigation } from "../features/plugins/plugin-navigation";
import {
  PluginShellActions,
  PluginSlot,
  usePluginSlotBatch,
} from "../features/plugins/plugin-slots";
import { Icon } from "./icon";
import { NavigationMark } from "./navigation-mark";
import { PluginMark } from "./plugin-mark";
import { SidebarConnections } from "./sidebar-connections";
import { TopbarTabsSlot } from "./topbar-slot";
import { Wordmark } from "./wordmark";

const SIDEBAR_KEY = "dsui.sidebar.collapsed";

/** Remembers the sidebar's collapsed state per browser. */
function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "true";
    } catch {
      return false;
    }
  });
  const toggle = useCallback(() => {
    setCollapsed((current) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, String(!current));
      } catch {
        // Storage can be unavailable; the toggle still works for this visit.
      }
      return !current;
    });
  }, []);
  return [collapsed, toggle] as const;
}

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
  const [sidebarCollapsed, toggleSidebar] = useSidebarCollapsed();
  const [tabsSlot, setTabsSlot] = useState<HTMLDivElement | null>(null);
  const [pluginCatalog, setPluginCatalog] = useState<
    Pick<PluginCatalog, "plugins" | "navigation">
  >({ plugins: [], navigation: [] });
  const pluginGroups = groupPluginNavigation(pluginCatalog);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Navigation refreshes the caller profile even when its pathname is not read.
  useEffect(() => {
    let active = true;
    let retryTimer: number | undefined;

    const loadPluginNavigation = async (retry = true) => {
      try {
        const catalog = await getPluginCatalog();
        if (active) setPluginCatalog(catalog);
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
  return (
    <div
      className={`app-chrome ${inAdapter ? "app-chrome--adapter" : ""}`}
      data-sidebar={sidebarCollapsed ? "collapsed" : "expanded"}
    >
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="app-topbar">
        <div className="app-topbar-brand">
          <Wordmark className="app-wordmark" />
          <button
            type="button"
            className="app-sidebar-toggle"
            onClick={toggleSidebar}
            aria-controls={inAdapter ? undefined : "workspace-sidebar"}
            aria-expanded={!sidebarCollapsed}
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon name="sidebar" />
          </button>
        </div>
        <div ref={setTabsSlot} className="app-topbar-tabs" />
        <div className="app-topbar-actions">
          <button
            type="button"
            className="app-search-button"
            onClick={openSearch}
            aria-label="Search"
            title="Search (⌘K)"
          >
            <Icon name="search" size={17} />
          </button>
          <PluginShellActions />
        </div>
      </header>
      <div className="app-body">
        {!inAdapter && (
          <aside
            id="workspace-sidebar"
            className="app-sidebar"
            aria-label="Workspace"
          >
            <div className="app-sidebar-navigation">
              <nav aria-label="Main navigation">
                <Link
                  to="/"
                  className="app-nav-link"
                  title="Home"
                  aria-label="Home"
                  aria-current={pathname === "/" ? "page" : undefined}
                >
                  <NavigationMark name="home" />
                  <span>Home</span>
                </Link>
                <SidebarConnections
                  pathname={pathname}
                  collapsed={sidebarCollapsed}
                  expandSidebar={toggleSidebar}
                />
                <Link
                  to="/settings"
                  className="app-nav-link"
                  title="Settings"
                  aria-label="Settings"
                  aria-current={
                    pathname.startsWith("/settings") ? "page" : undefined
                  }
                >
                  <NavigationMark name="settings" />
                  <span>Settings</span>
                </Link>
              </nav>
              {pluginGroups.map((group) => (
                <nav
                  key={group.label}
                  aria-label={`${group.label} plugins`}
                  className="app-sidebar-group"
                >
                  <h2 className="app-sidebar-group-label" title={group.label}>
                    {group.label}
                  </h2>
                  {group.items.map((item) => (
                    <Link
                      key={`${item.pluginId}/${item.id}`}
                      to="/plugins/$pluginId/$"
                      params={{ pluginId: item.pluginId, _splat: item.pageId }}
                      className="app-nav-link"
                      title={item.label}
                      aria-label={item.label}
                      aria-current={
                        pathname ===
                        `/plugins/${encodeURIComponent(item.pluginId)}/${item.pageId}`
                          ? "page"
                          : undefined
                      }
                    >
                      <PluginMark iconUrl={item.iconUrl} />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </nav>
              ))}
            </div>
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
              />
            </div>
          </aside>
        )}
        <main
          id="main-content"
          className="app-content"
          data-dsui-overlay-target="app.content"
        >
          <TopbarTabsSlot.Provider value={tabsSlot}>
            <Outlet />
          </TopbarTabsSlot.Provider>
        </main>
      </div>
    </div>
  );
}
