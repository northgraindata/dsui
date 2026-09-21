import { z } from "@northgraindata/dsui-adapter-sdk";

export const exampleConnectionSchema = z.object({
  baseUrl: z.string().url(),
  label: z.string().min(1).optional(),
});

export type ExampleConfig = z.output<typeof exampleConnectionSchema>;

export interface ExampleContext {
  config: ExampleConfig;
}

export function createContext(config: ExampleConfig): ExampleContext {
  return { config };
}
