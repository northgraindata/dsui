import { KeyValueList, Surface } from "@northgraindata/dsui-ui";
import { useEffect, useState } from "react";
import type { KeyValueProps } from "../primitives/key-value";
import { type ComponentProps, componentProps } from "../runtime";

export function KeyValue({ client, node }: ComponentProps) {
  const props = componentProps<KeyValueProps>(node);
  const [data, setData] = useState<Record<string, unknown> | undefined>(
    props?.data ? { ...props.data } : undefined,
  );
  useEffect(() => {
    if (!props?.source) return;
    let active = true;
    client.executeResource(props.source).then((result) => {
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
  }, [client, props?.source]);
  if (!props) return null;
  return data ? (
    <KeyValueList title={props.title} values={data} />
  ) : (
    <Surface className="p-4 text-[12px] text-secondary">
      Loading details…
    </Surface>
  );
}

export default KeyValue;
