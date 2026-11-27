import { Tooltip } from "@northgraindata/dsui-ui";

const SHOWN = 2;

function Chip({
  tag,
  onPick,
}: {
  tag: string;
  onPick?: (tag: string) => void;
}) {
  if (!onPick) return <span className="ax-chip-tag">{tag}</span>;
  return (
    <button
      type="button"
      className="ax-chip-tag"
      title={`Show DAGs tagged ${tag}`}
      onClick={(event) => {
        event.stopPropagation();
        onPick(tag);
      }}
    >
      {tag}
    </button>
  );
}

/** Two tags keep rows one height; the rest are listed on hover or focus. */
export function Tags({
  tags,
  onPick,
}: {
  tags: readonly string[];
  onPick?: (tag: string) => void;
}) {
  const rest = tags.slice(SHOWN);
  return (
    <span className="ax-tags">
      {tags.slice(0, SHOWN).map((tag) => (
        <Chip key={tag} tag={tag} onPick={onPick} />
      ))}
      {rest.length ? (
        <Tooltip
          label={
            <span className="ax-tags ax-tags-more">
              {rest.map((tag) => (
                <Chip key={tag} tag={tag} />
              ))}
            </span>
          }
        >
          <button
            type="button"
            className="ax-chip-tag ax-chip-rest"
            aria-label={`${rest.length} more tags: ${rest.join(", ")}`}
            onClick={(event) => event.stopPropagation()}
          >
            +{rest.length}
          </button>
        </Tooltip>
      ) : null}
    </span>
  );
}
