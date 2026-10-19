import {
  installationDefaults,
  preferenceDefaults,
} from "@northgraindata/dsui-core";
import { z } from "zod";

export const timeZoneSchema = z
  .string()
  .max(100)
  .refine((value) => {
    if (value === "browser") return true;
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid time zone");
export const installationSettingsSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    environment: z.enum(["local", "development", "staging", "production"]),
    timeZone: timeZoneSchema,
  })
  .strict();
export const userPreferencesSchema = z
  .object({
    timeZone: z.union([z.literal("inherit"), timeZoneSchema]),
    clock: z.enum(["24h", "12h"]),
    density: z.enum(["comfortable", "compact"]),
    editorFontSize: z.number().int().min(11).max(20),
    editorWordWrap: z.boolean(),
    editorTabSize: z.union([z.literal(2), z.literal(4)]),
  })
  .strict();
export { installationDefaults, preferenceDefaults };
