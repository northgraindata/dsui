import type { DataSource } from "../../resource";
import { defineComponent } from "../define";

export interface MeterSegment {
  label: string;
  value: number;
  tone?: "info" | "healthy" | "warning" | "unavailable" | "muted" | "deep";
  legend?: boolean;
}

export interface MeterData {
  segments: readonly MeterSegment[];
  footer?: string;
}

export interface MeterProps {
  source?: DataSource;
  data?: MeterData;
}

export interface MeterNode {
  readonly kind: "meter";
  readonly props: MeterProps;
}

export type PageMeterSegment = MeterSegment;
export type PageMeterData = MeterData;

export const Meter = defineComponent<MeterProps, MeterNode>({
  id: "meter",
  render: (props) => {
    if (props.data) {
      if (props.data.segments.length === 0)
        throw new Error("Meter requires at least one segment");
      for (const segment of props.data.segments) {
        if (!segment.label) throw new Error("Meter segments require a label");
        if (!Number.isFinite(segment.value) || segment.value < 0)
          throw new Error(
            "Meter segment values must be finite and non-negative",
          );
      }
    }
    return {
      kind: "meter",
      props: {
        ...props,
        data: props.data
          ? { ...props.data, segments: [...props.data.segments] }
          : undefined,
      },
    };
  },
});
