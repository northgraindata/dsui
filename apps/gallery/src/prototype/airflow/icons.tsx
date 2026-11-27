import activity from "./art/activity.webp";
import assets from "./art/assets.webp";
import connections from "./art/connections.webp";
import dags from "./art/dags.webp";
import home from "./art/home.webp";
import pools from "./art/pools.webp";
import runs from "./art/runs.webp";
import variables from "./art/variables.webp";

/** Generated in the style of the icons on the DSUI website. */
const art = {
  activity,
  assets,
  connections,
  dags,
  home,
  pools,
  runs,
  variables,
};
export type ArtName = keyof typeof art;

export function Art({ name, size = 22 }: { name: ArtName; size?: number }) {
  return (
    <img className="ax-art" src={art[name]} width={size} height={size} alt="" />
  );
}

export { Glyph, type GlyphName } from "../shared/glyphs";
