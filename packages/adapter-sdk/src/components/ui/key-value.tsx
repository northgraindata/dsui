import { KeyValueList, Surface } from "@northgraindata/dsui-ui";
import { useEffect, useState } from "react";
import type { KeyValueProps } from "../primitives/key-value";
import { type ComponentProps, componentProps } from "../runtime";
import { formatTimestamp, humanizeKey } from "./format-value";
import { useDisplayPreferences } from "./preferences";
import { usePropState } from "./use-prop-state";

export function KeyValue({ client, node, context }: ComponentProps) {
  const props = componentProps<KeyValueProps>(node);
  const [data, setData] = usePropState(
    props?.data as Record<string, unknown> | undefined,
  );
  const [error, setError] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  const preferences = useDisplayPreferences();
  useEffect(() => {
    if (!props?.source) return;
    let active = true;
    setError(undefined);
    client
      .executeResource(props.source)
      .then((result) => {
        if (!active) return;
        setLoaded(true);
        if (result && typeof result === "object" && !Array.isArray(result))
          setData(result as Record<string, unknown>);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load details",
          );
      });
    return () => {
      active = false;
    };
  }, [client, props?.source]);
  if (!props) return null;
  if (error)
    return (
      <Surface role="alert" className="p-4 text-[12px] text-unavailable">
        {error}
      </Surface>
    );
  const contextual = props.field ? context?.[props.field] : undefined;
  const displayed =
    contextual && typeof contextual === "object" && !Array.isArray(contextual)
      ? (contextual as Record<string, unknown>)
      : data;
  return displayed ? (
    <KeyValueList
      title={props.title}
      values={displayed}
      formatLabel={humanizeKey}
      formatEntry={(value) => formatTimestamp(value, preferences)}
    />
  ) : (
    <Surface className="p-4 text-[12px] text-secondary">
      {loaded ? "No details available." : "Loading details…"}
    </Surface>
  );
}

export default KeyValue;
