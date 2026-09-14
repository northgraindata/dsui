import { type ComponentProps, componentProps } from "../runtime";

const paths: Record<string, string> = {
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  copy: "M8 7H5v14h12v-3M9 3h11v14H9ZM12 3v3h5V3",
  reload: "M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5",
  close: "m6 6 12 12M18 6 6 18",
  check: "m5 12 4 4L19 6",
  chevron: "m9 5 7 7-7 7",
  "chevron-down": "m7 10 5 5 5-5",
  table:
    "M3 9h18M9 9v12M3 15h18M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z",
  plus: "M12 5v14M5 12h14",
  edit: "M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4",
  terminal: "m6 7 5 5-5 5M13 17h6",
};

interface IconValue {
  name: string | { field: string };
  size?: number;
}

export default function Icon({ node, context }: ComponentProps) {
  if (node.kind !== "custom") return null;
  const props = componentProps<IconValue>(node);
  const name = resolve(props?.name, context);
  if (!name) return null;
  const size = props?.size ?? 16;
  return (
    <span className="table-cell-icon">
      {/^(https?:)?\/\//i.test(name) ? (
        <img src={name} alt="" width={size} height={size} />
      ) : (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d={paths[name] ?? paths.table} />
        </svg>
      )}
    </span>
  );
}

function resolve(
  value: unknown,
  context: Record<string, unknown> | undefined,
): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || !("field" in value))
    return undefined;
  const resolved = String(value.field)
    .split(".")
    .reduce<unknown>((current, key) => {
      if (current && typeof current === "object")
        return (current as Record<string, unknown>)[key];
      return undefined;
    }, context);
  return resolved === undefined || resolved === null
    ? undefined
    : String(resolved);
}
