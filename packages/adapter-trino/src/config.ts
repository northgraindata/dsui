import { z } from "@northgraindata/dsui-adapter-sdk";
export const connectionSchema = z.object({
  url: z.string().url().default("http://localhost:8084"),
  user: z.string().min(1).default("dsui"),
  authentication: z.enum(["none", "password", "jwt"]).default("none"),
  password: z.string().min(1).optional(),
  token: z.string().min(1).optional(),
  catalog: z.string().min(1).optional(),
  schema: z.string().min(1).optional(),
  timeoutMs: z.coerce.number().int().min(1000).max(600000).default(120000),
});
export function validateConfig(config: Config) {
  return connectionSchema
    .superRefine((config, ctx) => {
      const url = new URL(config.url);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        ctx.addIssue({
          code: "custom",
          path: ["url"],
          message:
            "Use an HTTP(S) coordinator URL without credentials, query or fragment",
        });
      if (config.authentication !== "none" && url.protocol !== "https:")
        ctx.addIssue({
          code: "custom",
          path: ["url"],
          message: "Password and JWT authentication require HTTPS",
        });
      if (config.authentication === "password" && !config.password)
        ctx.addIssue({
          code: "custom",
          path: ["password"],
          message: "Password is required",
        });
      if (config.authentication === "jwt" && !config.token)
        ctx.addIssue({
          code: "custom",
          path: ["token"],
          message: "JWT token is required",
        });
      for (const key of ["user", "catalog", "schema"] as const)
        if (config[key] && /[\r\n]/.test(config[key]))
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "Header values cannot contain newlines",
          });
    })
    .parse(config);
}
export type Config = z.output<typeof connectionSchema>;
