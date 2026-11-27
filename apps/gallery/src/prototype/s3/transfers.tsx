import { go } from "../shared/ui";
import { nameOf, parentOf } from "./data";
import { folderPath } from "./pathbar";
import { clearTransfers, transfers, useStore } from "./store";

const SHOWN = 3;

/** Uploads started here. They stay in sight on every page until cleared. */
export function Transfers() {
  useStore();
  if (!transfers.length) return null;
  const running = transfers.filter((item) => item.progress < 100);
  const total = Math.round(
    transfers.reduce((sum, item) => sum + item.progress, 0) / transfers.length,
  );
  // Running ones first, then the newest finished ones.
  const rows = [
    ...running,
    ...transfers.filter((item) => item.progress >= 100).reverse(),
  ];
  const files = (count: number) => `${count} file${count === 1 ? "" : "s"}`;
  return (
    <section className="s3-transfers" aria-label="Uploads from this browser">
      <header>
        <strong role="status">
          {running.length
            ? `Uploading ${files(running.length)}`
            : `Uploaded ${files(transfers.length)}`}
        </strong>
        {running.length ? (
          <small>{total}%</small>
        ) : (
          <button type="button" className="ax-link" onClick={clearTransfers}>
            Clear
          </button>
        )}
      </header>
      <progress max={100} value={total} aria-label="All uploads" />
      <ul>
        {rows.slice(0, SHOWN).map((item) => (
          <li key={item.id}>
            <button
              type="button"
              title={`Open the folder of s3://${item.bucket}/${item.key}`}
              onClick={() => go(folderPath(item.bucket, parentOf(item.key)))}
            >
              <span>{nameOf(item.key)}</span>
              <small>
                {item.progress < 100 ? `${item.progress}%` : "Done"}
              </small>
            </button>
          </li>
        ))}
      </ul>
      {rows.length > SHOWN ? (
        <small>and {rows.length - SHOWN} more</small>
      ) : null}
    </section>
  );
}
