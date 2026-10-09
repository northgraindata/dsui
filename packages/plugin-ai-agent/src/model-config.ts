import { PluginRequestError, z } from "@northgraindata/dsui-plugin-sdk";
import type { Config } from "./model";

export const modelConnectionSchema = z.object({
  provider: z.enum(["openai", "anthropic", "gateway"]).default("openai"),
  id: z.string().min(1).default("gpt-4.1-mini"),
  apiKey: z.string().default(""),
});
export const namedModelSchema = modelConnectionSchema.extend({
  key: z
    .string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/)
    .refine(
      (key) => key !== "default",
      "default is reserved for the legacy model",
    ),
  label: z.string().trim().min(1).max(80).optional(),
});

export function configuredModels(config: Config) {
  const legacy = config.model.apiKey.trim()
    ? [{ ...config.model, key: "default", label: config.model.id }]
    : [];
  return [
    ...legacy,
    ...config.models
      .filter((model) => model.apiKey.trim())
      .map((model) => ({ ...model, label: model.label ?? model.id })),
  ];
}

export function selectModel(config: Config, key?: string) {
  const models = configuredModels(config);
  if (!models.length)
    throw new PluginRequestError(
      "Configure an agent model and API key in dsui.yaml",
      409,
    );
  const selected = key ? models.find((model) => model.key === key) : models[0];
  if (!selected)
    throw new PluginRequestError(
      "Selected model is no longer available. Choose a configured model.",
      422,
    );
  return selected;
}

export function modelSecrets(config: Config) {
  return [
    config.model.apiKey,
    ...config.models.map((model) => model.apiKey),
  ].filter(Boolean);
}
