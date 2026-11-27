import assets from "./art/assets.webp";
import automation from "./art/automation.webp";
import checks from "./art/checks.webp";
import deployment from "./art/deployment.webp";
import home from "./art/home.webp";
import jobs from "./art/jobs.webp";
import lineage from "./art/lineage.webp";
import partitions from "./art/partitions.webp";
import runs from "./art/runs.webp";

const art = {
  assets,
  automation,
  checks,
  deployment,
  home,
  jobs,
  lineage,
  partitions,
  runs,
};
export type ArtName = keyof typeof art;

export function Art({ name, size = 28 }: { name: ArtName; size?: number }) {
  return (
    <img className="ax-art" src={art[name]} width={size} height={size} alt="" />
  );
}
