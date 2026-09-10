import { Fragment } from "react";
import { Surface } from "./surface";

export function KeyValueList({
  title,
  values,
}: {
  title?: string;
  values: Record<string, unknown>;
}) {
  return (
    <Surface className="key-value-panel p-4">
      {title ? (
        <h2 className="m-0 mb-3 text-[13px] font-medium text-primary">
          {title}
        </h2>
      ) : null}
      <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-5 gap-y-2 text-[12px]">
        {Object.entries(values).map(([key, value]) => (
          <Fragment key={key}>
            <dt className="text-secondary">{key}</dt>
            <dd className="m-0 break-words text-primary">
              {formatValue(value)}
            </dd>
          </Fragment>
        ))}
      </dl>
    </Surface>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
