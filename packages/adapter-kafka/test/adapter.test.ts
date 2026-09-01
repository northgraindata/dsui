import { expect, test } from "bun:test";
import adapter from "../src/index";

test("requires SASL credentials", () => {
  expect(() =>
    adapter.connectionSchema.parse({
      brokers: ["localhost:9092"],
      saslMechanism: "plain",
    }),
  ).toThrow();
});
test("bounds message reads", () => {
  expect(
    adapter.capabilities.find((capability) => capability.id === "messages")
      ?.maxPageSize,
  ).toBe(100);
});

test("covers the Kafbat management surface", () => {
  const ids = adapter.capabilities.map((capability) => capability.id);
  for (const id of [
    "brokers",
    "broker-config",
    "topics",
    "messages",
    "produce-message",
    "consumer-groups",
    "reset-offsets",
    "acls",
    "schema-subjects",
    "register-schema",
    "connectors",
    "connector-action",
  ])
    expect(ids).toContain(id);
  expect(adapter.secretPaths).toContain("schemaRegistryPassword");
  expect(adapter.secretPaths).toContain("connectPassword");
});
