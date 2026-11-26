import type { Page } from "@playwright/test";

/**
 * Panes whose content is wider than they are. Content inside its own scroll
 * container does not count, so intentional table scrolling passes.
 */
export function overflowingPanes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const describe = (element: Element) =>
      `${element.tagName.toLowerCase()}.${[...element.classList].join(".")}`;
    const panes = [
      document.documentElement,
      ...document.querySelectorAll("[data-gallery-pane]"),
    ];
    return panes.flatMap((pane) => {
      if (pane.scrollWidth <= pane.clientWidth + 1) return [];
      const limit = pane.getBoundingClientRect().left + pane.clientWidth + 1;
      const scrolls = (element: Element) => {
        for (
          let parent = element.parentElement;
          parent && parent !== pane;
          parent = parent.parentElement
        )
          if (getComputedStyle(parent).overflowX !== "visible") return true;
        return false;
      };
      const culprit = [...pane.querySelectorAll("*")].find(
        (element) =>
          element.getBoundingClientRect().right > limit && !scrolls(element),
      );
      return [
        `${describe(pane)} is ${pane.scrollWidth}px in ${pane.clientWidth}px; first offender ${culprit ? describe(culprit) : "unknown"}`,
      ];
    });
  });
}

/** Rendered controls that collapsed to nothing and cannot be used. */
export function collapsedControls(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("button, a[href], input, select, textarea")]
      .filter((element) => {
        if (!element.checkVisibility({ visibilityProperty: true }))
          return false;
        if (element.closest(".sr-only, [aria-hidden='true']")) return false;
        if (element.matches("input[type='hidden']")) return false;
        const box = element.getBoundingClientRect();
        return box.width === 0 || box.height === 0;
      })
      .map((element) => element.outerHTML.slice(0, 160)),
  );
}
