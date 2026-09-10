import type { RegistryViewProps } from "../registry/view-registry";

/** Page header: title with optional description. */
export function PageHeaderView({ node }: RegistryViewProps) {
  if (node.kind !== "page-header") return null;
  return (
    <header>
      <h1 className="m-0 text-[17px] font-semibold text-primary">
        {node.props.title}
      </h1>
      {node.props.description ? (
        <p className="mt-1 text-[12px] text-secondary">
          {node.props.description}
        </p>
      ) : null}
    </header>
  );
}
