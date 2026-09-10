import { KeyValueList, Surface } from "@northgraindata/dsui-ui";
import { useEffect, useState } from "react";
import { type RegistryViewProps, registerView } from "../registry";

export function KeyValueView({ client, node }: RegistryViewProps) {
  const source = node.kind === "key-value" ? node.props.source : undefined;
  const [data, setData] = useState<Record<string, unknown> | undefined>(
    node.kind === "key-value" ? node.props.data : undefined,
  );
  useEffect(() => {
    if (!source) return;
    let active = true;
    client.executeResource(source).then((result) => {
      if (
        active &&
        result &&
        typeof result === "object" &&
        !Array.isArray(result)
      )
        setData(result as Record<string, unknown>);
    });
    return () => {
      active = false;
    };
  }, [client, source]);
  if (node.kind !== "key-value") return null;
  return data ? (
    <KeyValueList title={node.props.title} values={data} />
  ) : (
    <Surface className="p-4 text-[12px] text-secondary">
      Loading details…
    </Surface>
  );
}

registerView("key-value", KeyValueView);
