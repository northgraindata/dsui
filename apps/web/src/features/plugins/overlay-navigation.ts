/** Compare decoded query parameters so router encoding cannot reset a live page. */
export function sameOverlayLocation(current: string, destination: string) {
  const left = new URL(current, "http://dsui.local");
  const right = new URL(destination, "http://dsui.local");
  left.searchParams.sort();
  right.searchParams.sort();
  return (
    left.origin === right.origin &&
    left.pathname === right.pathname &&
    left.searchParams.toString() === right.searchParams.toString() &&
    left.hash === right.hash
  );
}
/** Plugin routes are app-relative; history and browser navigation need the mount path. */
export function overlayHref(path: string, base: string) {
  const prefix = base.replace(/\/$/, "");
  return `${prefix}${path}`;
}
/** Router locations have already had the mount path removed by TanStack. */
export function overlayMatchesRoute(pathname: string, destination: string) {
  return pathname === new URL(destination, "http://dsui.local").pathname;
}
