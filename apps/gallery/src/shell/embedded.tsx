/**
 * Shows a redesign inside the real application, in place of the current pages.
 * The old pages stay mounted and hidden, so switching is instant. Nothing in the
 * product knows about this: the gallery adds its own hosts to the shell.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { setNavigator } from "../prototype/shared/ui";
import { type Redesigned, redesignFor } from "./redesigns";
import "./embedded.css";

/** An element of ours at the end of a shell element, once that one exists. */
function useHost(selector: string, className: string): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const element = document.createElement("div");
    element.className = className;
    const attach = () => {
      const parent = document.querySelector(selector);
      if (parent && element.parentElement !== parent) parent.append(element);
      setHost(element.isConnected ? element : null);
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      element.remove();
    };
  }, [selector, className]);
  return host;
}

export function Redesign({ pathname }: { pathname: string }) {
  const design = redesignFor(pathname);
  // A different service starts a fresh view with its own state.
  return design ? (
    <Shown key={design.prefix} design={design} pathname={pathname} />
  ) : null;
}

function Shown({ design, pathname }: { design: Redesigned; pathname: string }) {
  const {
    prefix: PREFIX,
    Page,
    SideNav,
    currentPageFor,
    redesignedPageFor,
  } = design;
  const [path, setPath] = useState(() => redesignedPageFor(pathname));
  const nav = useHost(".adapter-sidebar", "ax-app ax-sidebar ax-embedded-nav");
  const content = useHost(".adapter-main", "ax-app ax-embedded-main");
  const shown = useRef(pathname);

  // Tabs, back and forward change the address without going through us.
  useEffect(() => {
    if (shown.current === pathname) return;
    shown.current = pathname;
    setPath((current) =>
      `${PREFIX}${currentPageFor(current)}`.replace(/\/$/, "") === pathname
        ? current
        : redesignedPageFor(pathname),
    );
  }, [pathname, PREFIX, currentPageFor, redesignedPageFor]);

  useEffect(() => {
    document.documentElement.dataset.design = "new";
    setNavigator((next) => {
      setPath(next);
      const target = `${PREFIX}${currentPageFor(next)}`.replace(/\/$/, "");
      shown.current = target;
      // The app's router watches the history API, so its address follows.
      if (location.pathname !== target) history.pushState({}, "", target);
      window.scrollTo(0, 0);
      document.querySelector(".app-content")?.scrollTo(0, 0);
    });
    return () => {
      delete document.documentElement.dataset.design;
    };
  }, [PREFIX, currentPageFor]);

  return (
    <>
      {nav ? createPortal(<SideNav path={path} />, nav) : null}
      {content
        ? createPortal(
            <div className="ax-page">
              <Page path={path} />
            </div>,
            content,
          )
        : null}
    </>
  );
}
