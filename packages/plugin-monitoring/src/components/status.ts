/**
 * A note standing in for a panel that has nothing to show.
 *
 * Used when a section has no data, so an empty volume list reads as "nothing
 * sampled" rather than as a panel that failed to render. `CodeBlock` is used
 * because it is the SDK's text primitive for a static string; the note is
 * prose, not code, and this is the least shouty way to say it.
 */
import { Card, Section } from "@northgraindata/dsui-plugin-sdk";

export function statusNote(input: {
  text: string;
  tone?: "unavailable" | "warning" | "ok";
}) {
  return Section({
    title: "Unavailable",
    content: Card({
      title: input.text,
      variant: "subtle",
    }),
  });
}
