import type { RegistryViewProps } from "../registry/view-registry";

export function SelectView({ node }: RegistryViewProps) {
  if (node.kind !== "select") return null;
  return (
    <select
      aria-label={node.props.label ?? node.props.name}
      className="min-h-[34px] border border-border-strong bg-background px-2.5 text-primary"
    >
      {node.props.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
