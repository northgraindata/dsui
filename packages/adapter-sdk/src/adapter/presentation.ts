import { z } from "zod";

/** Optional, author-maintained catalog content. Runtime capabilities remain separate. */
export const adapterPresentationSchema = z.object({
  category: z.string().trim().min(1).optional(),
  overview: z.string().trim().min(1).optional(),
  features: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        description: z.string().trim().min(1).optional(),
      }),
    )
    .optional(),
  compatibility: z.array(z.string().trim().min(1)).optional(),
  limitations: z.array(z.string().trim().min(1)).optional(),
  links: z
    .array(
      z.object({
        kind: z.enum(["website", "documentation", "source"]).optional(),
        label: z.string().trim().min(1),
        href: z
          .string()
          .url()
          .refine(
            (value) => /^https?:\/\//i.test(value),
            "Catalog links must use HTTP or HTTPS",
          ),
      }),
    )
    .optional(),
});

export type AdapterPresentation = z.infer<typeof adapterPresentationSchema>;
