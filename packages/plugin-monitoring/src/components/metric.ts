/**
 * A labelled reading, rendered as a card.
 *
 * Shared by every panel on the overview so the sections stay visually
 * identical without repeating the markup. The value is rendered as data rather
 * than as prose, so the card shows a label and a number with no formatting
 * logic in this file.
 */
import { Card, type CardProps, Value } from "@northgraindata/dsui-plugin-sdk";

export function metric(input: {
  label: string;
  icon?: string;
  value: string;
  field?: string;
  /** Secondary line explaining the number, e.g. its denominator. */
  hint?: CardProps["description"];
}) {
  return Card({
    title: input.label,
    description: input.hint,
    variant: "metric",
    icon: input.icon,
    content: Value({ field: input.field ?? "reading", fallback: input.value }),
  });
}
