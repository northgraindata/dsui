import activity from "./art/activity.webp";
import buckets from "./art/buckets.webp";
import files from "./art/files.webp";
import settings from "./art/settings.webp";

const art = { activity, buckets, files, settings };
export type ArtName = keyof typeof art;

export function Art({ name, size = 28 }: { name: ArtName; size?: number }) {
  return (
    <img className="ax-art" src={art[name]} width={size} height={size} alt="" />
  );
}
