import { cn } from "@northgraindata/dsui-ui";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { getPluginCatalog, getServices, type Service } from "../api";
import { AppChrome } from "../components/app-chrome";
import { Icon } from "../components/icon";
import { ServiceMark } from "../components/service-mark";
import { ShortcutsDialog } from "../components/shortcuts-dialog";
import {
  AdapterTabsProvider,
  useAdapterTabs,
} from "../features/adapter-workspace/adapter-tabs-context";
import { visibleAdapterTabs } from "../features/adapter-workspace/adapter-tabs-state";
import { PluginOverlayLayer } from "../features/plugins/plugin-overlay-layer";
import { SettingsProvider } from "../features/settings/settings-provider";
import { useShortcuts } from "../shortcuts";

/** Whether the DSUI Agent plugin, which owns ⌘J, is ready to open. */
function useAgentAvailable(enabled: boolean) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    getPluginCatalog()
      .then((catalog) => {
        if (active)
          setAvailable(
            catalog.plugins.some(
              (plugin) => plugin.id === "ai-agent" && plugin.status === "ready",
            ),
          );
      })
      .catch(() => active && setAvailable(false));
    return () => {
      active = false;
    };
  }, [enabled]);
  return available;
}

export function AppShell() {
  return (
    <SettingsProvider>
      <AdapterTabsProvider>
        <ShellContent />
      </AdapterTabsProvider>
    </SettingsProvider>
  );
}

function ShellContent() {
  const navigate = useNavigate();
  const { state: tabs } = useAdapterTabs();
  const [commandOpen, setCommandOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [barePluginPage, setBarePluginPage] = useState<{
    pathname: string;
    bare: boolean;
  }>();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isAuthPage = pathname === "/login" || pathname === "/setup";
  const pluginPage = /^\/plugins\/([^/]+)\/(.+)$/.exec(pathname);
  const hideAppChrome =
    isAuthPage ||
    (barePluginPage?.pathname === pathname && barePluginPage.bare);

  useEffect(() => {
    if (!pluginPage) {
      setBarePluginPage(undefined);
      return;
    }
    let active = true;
    const [, rawPluginId, rawPageId] = pluginPage;
    if (!rawPluginId || !rawPageId) return;
    const pluginId = decodeURIComponent(rawPluginId);
    const pageId = decodeURIComponent(rawPageId);
    getPluginCatalog()
      .then((catalog) => {
        if (!active) return;
        const page = catalog.pages.find(
          (candidate) =>
            candidate.pluginId === pluginId && candidate.id === pageId,
        );
        setBarePluginPage({ pathname, bare: page?.shell === "bare" });
      })
      .catch(() => {
        if (active) setBarePluginPage({ pathname, bare: false });
      });
    return () => {
      active = false;
    };
  }, [pathname, pluginPage?.[1], pluginPage?.[2]]);

  const agentAvailable = useAgentAvailable(shortcutsOpen);
  const switchTab = (step: 1 | -1) => {
    const ids = visibleAdapterTabs(tabs).map((tab) =>
      tab.kind === "split" ? tab.leftId : tab.id,
    );
    if (!ids.length) return;
    const current = /^\/services\/([^/]+)/.exec(pathname)?.[1];
    const index = current ? ids.indexOf(decodeURIComponent(current)) : -1;
    const next =
      index < 0
        ? ids[step > 0 ? 0 : ids.length - 1]
        : ids[(index + step + ids.length) % ids.length];
    if (next)
      void navigate({
        to: "/services/$serviceId",
        params: { serviceId: next },
      });
  };

  useShortcuts(
    {
      search: () => setCommandOpen(true),
      shortcuts: () => setShortcutsOpen((open) => !open),
      "next-tab": () => switchTab(1),
      "previous-tab": () => switchTab(-1),
    },
    !hideAppChrome,
  );

  if (hideAppChrome) return <Outlet />;

  return (
    <>
      <AppChrome pathname={pathname} openSearch={() => setCommandOpen(true)} />
      <PluginOverlayLayer />
      {commandOpen && <CommandPalette close={() => setCommandOpen(false)} />}
      {shortcutsOpen && (
        <ShortcutsDialog
          close={() => setShortcutsOpen(false)}
          agentAvailable={agentAvailable}
        />
      )}
    </>
  );
}

const paletteRow =
  "flex h-8 w-full items-center gap-2.5 border-0 bg-transparent px-3 text-left text-[12px] text-secondary transition-colors hover:bg-surface-hover hover:text-primary";

type PaletteItem = {
  id: string;
  label: string;
  /** Extra words that should find this item, such as "help". */
  keywords?: string;
  icon: ReactNode;
  run: () => void;
};

/** Palette entries grouped for display, filtered by the typed query. */
function paletteGroups({
  query,
  services,
  go,
}: {
  query: string;
  services: readonly Service[];
  go: (to: string) => void;
}): [string, PaletteItem[]][] {
  const commands: PaletteItem[] = [
    {
      id: "home",
      label: "Dashboard",
      keywords: "home",
      icon: <Icon name="grid" />,
      run: () => go("/"),
    },
    {
      id: "add-service",
      label: "Add service",
      keywords: "new connection adapter",
      icon: <Icon name="plus" />,
      run: () => go("/services/new"),
    },
  ];
  const serviceItems: PaletteItem[] = services.map((service) => ({
    id: service.id,
    label: service.name,
    keywords: service.adapter,
    icon: <ServiceMark adapter={service.adapter} logo={service.logo} />,
    run: () => go(`/services/${service.id}`),
  }));
  const needle = query.trim().toLowerCase();
  const matches = (item: PaletteItem) =>
    !needle ||
    `${item.label} ${item.keywords ?? ""}`.toLowerCase().includes(needle);
  return [
    ["Commands", commands.filter(matches)],
    ["Services", serviceItems.filter(matches)],
  ];
}

function CommandPalette({ close }: { close: () => void }) {
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [query, setQuery] = useState("");
  const [entered, setEntered] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let secondFrame: number | undefined;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const requestClose = useCallback(
    (after?: () => void) => {
      if (closeTimer.current) return;
      setEntered(false);
      closeTimer.current = window.setTimeout(() => {
        close();
        after?.();
      }, 260);
    },
    [close],
  );

  const go = (to: string) => {
    requestClose(() => navigate({ to: to as never }));
  };

  useEffect(() => {
    getServices()
      .then(setServices)
      .catch(() => setServices([]));
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    addEventListener("keydown", handleKeyDown);
    return () => removeEventListener("keydown", handleKeyDown);
  }, [requestClose]);

  const groups = paletteGroups({ query, services, go });
  const visible = groups.flatMap(([, items]) => items);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop dismisses on outside press; the dialog itself carries the semantic role
    <div
      className={cn(
        "command-palette__backdrop fixed inset-0 z-50 bg-canvas/80 backdrop-blur-[2px]",
      )}
      data-entered={entered}
      role="presentation"
      onMouseDown={() => requestClose()}
    >
      <div
        className={cn(
          "command-palette__panel mx-auto mt-[15vh] w-full max-w-md border border-border-strong bg-surface-raised ring-1 ring-accent/10",
        )}
        data-entered={entered}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex h-11 items-center gap-2.5 border-b border-border px-3 text-muted focus-within:border-accent">
          <Icon name="search" />
          <input
            ref={(element) => element?.focus()}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") visible[0]?.run();
            }}
            placeholder="Search commands…"
            aria-label="Search commands"
            className="h-full w-full border-0 bg-transparent font-mono text-[12px] text-primary outline-none placeholder:text-muted"
          />
        </div>
        <PaletteResults groups={groups} />
      </div>
    </div>
  );
}

function PaletteResults({ groups }: { groups: [string, PaletteItem[]][] }) {
  const empty = groups.every(([, items]) => items.length === 0);
  return (
    <div className="max-h-80 overflow-auto p-1.5">
      {empty && (
        <p className="px-3 py-3 text-[12px] text-muted">
          No matching commands.
        </p>
      )}
      {groups.map(([title, items]) =>
        items.length ? (
          <div key={title}>
            <p className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              {title}
            </p>
            {items.map((item) => (
              <button
                type="button"
                key={item.id}
                className={paletteRow}
                onClick={item.run}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        ) : null,
      )}
    </div>
  );
}
