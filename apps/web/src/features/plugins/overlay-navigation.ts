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
