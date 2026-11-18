import { expect, test } from "bun:test";
import {
  matchingMentionServices,
  mentionServices,
  serviceMentions,
} from "./mentions";
import { conversationTitle } from "./title";

test("adapter search finds each named service and keeps mentions unambiguous", () => {
  const services = mentionServices([
    { id: "retail-db", name: "Retail", adapter: "duckdb" },
    { id: "events-db", name: "Events", adapter: "duckdb" },
    { id: "warehouse", name: "Warehouse", adapter: "postgresql" },
  ]);
  expect(
    matchingMentionServices(services, "DUCKDB").map(({ handle }) => handle),
  ).toEqual(["retail", "events"]);
  expect(
    matchingMentionServices(services, "retail").map(({ id }) => id),
  ).toEqual(["retail-db"]);
  expect(serviceMentions("Inspect @retail", services)[0]?.service?.id).toBe(
    "retail-db",
  );
});

test("conversation has a useful title before a model-generated title arrives", () => {
  expect(
    conversationTitle("Dlaczego Retail nie działa?\nSprawdź połączenie", []),
  ).toBe("Dlaczego Retail nie działa?");
  expect(conversationTitle("", ["schema.sql"])).toBe("schema.sql");
  expect(conversationTitle("x".repeat(100), [])).toHaveLength(70);
});
