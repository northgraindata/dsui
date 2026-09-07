import { expect, test } from "bun:test";
import { manual, poll } from "./define";
import type { PollInterval } from "./types";

test("poll parses duration shorthands", () => {
  expect(poll("5s")).toEqual({ kind: "poll", intervalMs: 5000 });
  expect(poll("30s")).toEqual({ kind: "poll", intervalMs: 30_000 });
  expect(poll("500ms")).toEqual({ kind: "poll", intervalMs: 500 });
  expect(poll("2m")).toEqual({ kind: "poll", intervalMs: 120_000 });
});

test("poll accepts raw milliseconds", () => {
  expect(poll(250)).toEqual({ kind: "poll", intervalMs: 250 });
});

test("poll rejects invalid intervals", () => {
  // Invalid literals are rejected by types; cast to reach runtime validation.
  expect(() => poll("soon" as PollInterval)).toThrow();
  expect(() => poll("5h" as PollInterval)).toThrow();
  expect(() => poll(0)).toThrow();
  expect(() => poll(-100)).toThrow();
});

test("manual creates a non-polling strategy", () => {
  expect(manual()).toEqual({ kind: "manual" });
});
