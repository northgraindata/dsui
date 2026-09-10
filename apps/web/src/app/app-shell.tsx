import { cn } from "@northgraindata/dsui-ui";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { getServices, type Service } from "../api";
import { AppChrome } from "../components/app-chrome";
import { Icon } from "../components/icon";
import { ServiceMark } from "../components/service-mark";

function useShortcut(key: string, fn: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === key) {
        event.preventDefault();
        fn();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [key, fn]);
}

export function AppShell() {
  const [commandOpen, setCommandOpen] = useState(false);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isAuthPage = pathname === "/login" || pathname === "/setup";

  useShortcut("k", () => {
    if (!isAuthPage) setCommandOpen(true);
  });

  if (isAuthPage) return <Outlet />;

  return (
    <>
      <AppChrome pathname={pathname} openSearch={() => setCommandOpen(true)} />
      {commandOpen && <CommandPalette close={() => setCommandOpen(false)} />}
    </>
  );
}

const paletteRow =
  "flex h-8 w-full items-center gap-2.5 border-0 bg-transparent px-3 text-left text-[12px] text-secondary transition-colors hover:bg-surface-hover hover:text-primary";

function CommandPalette({ close }: { close: () => void }) {
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
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
            placeholder="Search commands…"
            className="h-full w-full border-0 bg-transparent font-mono text-[12px] text-primary outline-none placeholder:text-muted"
          />
        </div>
        <div className="max-h-80 overflow-auto p-1.5">
          <p className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            Navigate
          </p>
          <button type="button" className={paletteRow} onClick={() => go("/")}>
            <Icon name="grid" /> Dashboard{" "}
            <kbd className="ml-auto font-mono text-[10px] text-muted">↵</kbd>
          </button>
          <button
            type="button"
            className={paletteRow}
            onClick={() => go("/services/new")}
          >
            <Icon name="plus" /> Add service
          </button>
          {services.length > 0 && (
            <p className="px-3 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              Services
            </p>
          )}
          {services.map((service) => (
            <button
              type="button"
              key={service.id}
              className={paletteRow}
              onClick={() => go(`/services/${service.id}`)}
            >
              <ServiceMark adapter={service.adapter} logo={service.logo} />{" "}
              {service.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
