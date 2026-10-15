import { expect, test } from "bun:test";
import { sameOverlayLocation } from "./overlay-navigation";

test("advancing a tour preserves query results despite equivalent URL encoding", () => {
  const path = "/services/snapshot/query";
  expect(
    sameOverlayLocation(
      `${path}?sql=SELECT+%27paid%27%3B`,
      `${path}?sql=SELECT%20'paid'%3B`,
    ),
  ).toBe(true);
  expect(sameOverlayLocation(`${path}?a=1&b=2`, `${path}?b=2&a=1`)).toBe(true);
  expect(sameOverlayLocation(`${path}?sql=one`, `${path}?sql=two`)).toBe(false);
  expect(sameOverlayLocation(path, "/services/analytics/query")).toBe(false);
  expect(sameOverlayLocation(path, `${path}?sql=`)).toBe(false);
});
