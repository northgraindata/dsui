/* Materializing: at once, or as a backfill when assets are partitioned. */
import { Button, Input, Modal, notify } from "@northgraindata/dsui-ui";
import { useState } from "react";
import { Glyph } from "../shared/glyphs";
import { Segments } from "../shared/list";
import { Art } from "./art";
import { partitionsOf } from "./catalog";
import { assetByKey } from "./graph";

type Which = "gaps" | "latest" | "range";

export function MaterializeDialog({
  keys,
  range,
  onClose,
}: {
  keys: readonly string[];
  /** A range already picked on the partition map. */
  range?: [string, string];
  onClose: () => void;
}) {
  const parts = keys.map(partitionsOf).filter((item) => item !== undefined);
  const first = parts[0];
  const gaps = first
    ? first.keys.filter(
        (key) => first.missing.has(key) || first.failed.has(key),
      )
    : [];
  const [which, setWhich] = useState<Which>(
    range ? "range" : gaps.length ? "gaps" : "latest",
  );
  const [from, setFrom] = useState(range?.[0] ?? first?.keys.at(-7) ?? "");
  const [to, setTo] = useState(range?.[1] ?? first?.keys.at(-1) ?? "");
  const [tags, setTags] = useState("");
  const chosen = !first
    ? 0
    : which === "latest"
      ? 1
      : which === "gaps"
        ? gaps.length
        : first.keys.filter((key) => key >= from && key <= to).length;
  const blocking = keys.some((key) => !assetByKey.has(key));
  const name =
    keys.length === 1
      ? (keys[0]?.split("/").at(-1) ?? "")
      : `${keys.length} assets`;
  const mixed = parts.length > 0 && parts.length < keys.length;
  return (
    <Modal
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Materialize"
    >
      <div className="ax-app ax-modal dx-modal">
        <div className="dx-modal-title">
          <Art name={first ? "partitions" : "assets"} size={40} />
          <div>
            <strong>{name}</strong>
            <small>
              {first
                ? `${first.keys.length.toLocaleString("en")} partitions, ${gaps.length} missing or failed`
                : "One run materializes the selection in dependency order."}
            </small>
          </div>
        </div>
        {first ? (
          <>
            <Segments
              label="Partitions"
              value={which}
              onChange={setWhich}
              options={[
                ...(gaps.length
                  ? [
                      {
                        value: "gaps" as const,
                        label: "Missing and failed",
                        count: gaps.length,
                      },
                    ]
                  : []),
                { value: "latest" as const, label: "Latest" },
                { value: "range" as const, label: "Range" },
              ]}
            />
            {which === "range" ? (
              <div className="dx-fields">
                <div className="ax-field">
                  <span>From</span>
                  <Input
                    aria-label="From partition"
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                  />
                </div>
                <div className="ax-field">
                  <span>To</span>
                  <Input
                    aria-label="To partition"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                  />
                </div>
              </div>
            ) : null}
            {mixed ? (
              <p className="dx-warning">
                <Glyph name="alert" size={14} />
                Assets without partitions are materialized once, with the
                backfill.
              </p>
            ) : null}
          </>
        ) : null}
        <div className="ax-field">
          <span>Run tags (optional)</span>
          <Input
            aria-label="Run tags"
            placeholder="team=finance, reason=fix"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
        </div>
        <footer>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={blocking || Boolean(first && !chosen)}
            onClick={() => {
              notify.success(
                first && chosen > 1
                  ? `Backfill of ${chosen.toLocaleString("en")} partitions launched (prototype)`
                  : "Run launched (prototype)",
              );
              onClose();
            }}
          >
            <Glyph name="bolt" size={13} />
            {first && chosen > 1
              ? `Launch backfill (${chosen.toLocaleString("en")})`
              : "Materialize"}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
