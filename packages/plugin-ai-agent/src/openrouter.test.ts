import { expect, spyOn, test } from "bun:test";
import { AiSdkRuntime } from "./agent";
import { configSchema } from "./model";
import { configuredModels } from "./model-config";

test("OpenRouter models support both legacy config and the model picker", () => {
  const model = {
    provider: "openrouter",
    id: "~openai/gpt-sol-latest",
    apiKey: "test-key",
  };
  const config = configSchema.parse({
    model,
    models: [{ ...model, key: "router" }],
  });
  expect(configuredModels(config).map(({ provider }) => provider)).toEqual([
    "openrouter",
    "openrouter",
  ]);
});

test("OpenRouter uses Chat Completions with its endpoint, model ID and credentials", async () => {
  let url = "";
  let authorization = "";
  let requestedModel: unknown;
  const fetch = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async (
        input: Parameters<typeof globalThis.fetch>[0],
        init?: Parameters<typeof globalThis.fetch>[1],
      ) => {
        url = String(input);
        authorization = new Headers(init?.headers).get("authorization") ?? "";
        const body: unknown = JSON.parse(String(init?.body));
        if (body && typeof body === "object" && "model" in body)
          requestedModel = body.model;
        return Response.json({
          id: "chat-test",
          object: "chat.completion",
          created: 1,
          model: "~openai/gpt-sol-latest",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "Inspect dbt" },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });
      },
      { preconnect: globalThis.fetch.preconnect },
    ),
  );
  try {
    const title = await new AiSdkRuntime().title({
      model: {
        provider: "openrouter",
        id: "~openai/gpt-sol-latest",
        apiKey: "test-key",
      },
      message: "Inspect dbt",
      attachmentNames: [],
      signal: new AbortController().signal,
    });
    expect(title).toBe("Inspect dbt");
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(authorization).toBe("Bearer test-key");
    expect(requestedModel).toBe("~openai/gpt-sol-latest");
  } finally {
    fetch.mockRestore();
  }
});
