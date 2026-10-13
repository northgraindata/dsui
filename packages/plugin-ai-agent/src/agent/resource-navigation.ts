import { z } from "@northgraindata/dsui-plugin-sdk";

const navigationSchema = z.array(
  z
    .object({
      label: z.string().min(1),
      path: z.string().min(1),
    })
    .passthrough(),
);

/** The provider supplies verified navigation paths scoped to its service. */
export function resourceNavigation(serviceId: string, output: unknown) {
  if (!output || typeof output !== "object" || !("navigation" in output))
    return [];
  const entries = navigationSchema.safeParse(output.navigation);
  if (!entries.success) return [];
  const prefix = `/services/${encodeURIComponent(serviceId)}`;
  return entries.data.flatMap((entry) => {
    if (
      !entry.path.startsWith("/") ||
      entry.path.startsWith("//") ||
      /[\s\\]/.test(entry.path)
    )
      return [];
    const href = `${prefix}${entry.path}`.replace(/[()]/g, (character) =>
      character === "(" ? "%28" : "%29",
    );
    const url = new URL(href, "https://dsui.invalid");
    if (
      url.origin !== "https://dsui.invalid" ||
      !url.pathname.startsWith(`${prefix}/`)
    )
      return [];
    return [{ ...entry, href }];
  });
}
