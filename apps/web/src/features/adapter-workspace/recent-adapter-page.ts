const recentAdapterPageKey = "dsui.recent-adapter-page";

export type RecentAdapterPage = {
  serviceId: string;
  path: string;
  href: string;
};

export function recordAdapterPage(page: RecentAdapterPage) {
  try {
    sessionStorage.setItem(recentAdapterPageKey, JSON.stringify(page));
  } catch {
    // The shortcut is optional when browser storage is unavailable.
  }
}

export function readRecentAdapterPage(): RecentAdapterPage | undefined {
  try {
    const stored = sessionStorage.getItem(recentAdapterPageKey);
    if (!stored) return;
    const page: unknown = JSON.parse(stored);
    if (
      page &&
      typeof page === "object" &&
      "serviceId" in page &&
      typeof page.serviceId === "string" &&
      page.serviceId &&
      "path" in page &&
      typeof page.path === "string" &&
      page.path.startsWith("/") &&
      "href" in page &&
      typeof page.href === "string" &&
      page.href.startsWith("/")
    ) {
      const url = new URL(page.href, window.location.origin);
      if (
        url.origin === window.location.origin &&
        !url.pathname.startsWith("//")
      ) {
        return {
          serviceId: page.serviceId,
          path: page.path,
          href: `${url.pathname}${url.search}`,
        };
      }
    }
  } catch {
    // Ignore unavailable storage or an invalid entry.
  }
}
