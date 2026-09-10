import { Button } from "@northgraindata/dsui-ui";
import type { RegistryViewProps } from "../registry/view-registry";

export function ButtonView({ client, node }: RegistryViewProps) {
  if (node.kind !== "button") return null;
  return (
    <Button
      variant={
        node.props.variant === "primary" ? "default" : node.props.variant
      }
      onClick={() => {
        if (node.props.link) client.navigate(node.props.link);
        else if (node.props.action) client.executeAction(node.props.action);
      }}
    >
      {node.props.label}
    </Button>
  );
}
