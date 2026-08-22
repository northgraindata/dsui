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
