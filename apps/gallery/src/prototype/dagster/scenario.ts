/** The gallery can show the same instance with nothing wrong. */
export const everythingHealthy = (() => {
  try {
    return sessionStorage.getItem("dsui-prototype-failing") === "none";
  } catch {
    return false;
  }
})();

/** A steady number from a text, so invented data never changes. */
export function hash(text: string): number {
  let value = 2_166_136_261;
  for (let index = 0; index < text.length; index += 1)
    value = Math.imul(value ^ text.charCodeAt(index), 16_777_619);
  return value >>> 0;
}
