import { expect, test } from "bun:test";
import { gitAdapterSourceSchema } from "../src/config";

const repository = "git+https://github.com/northgraindata/dsui";

test("a git adapter source needs no commit or integrity: it is built from its ref", () => {
  expect(
    gitAdapterSourceSchema.safeParse({
      path: "packages/adapter-postgresql",
      ref: "main",
      repository,
      source: "git",
    }).success,
  ).toBe(true);
});

test("a git adapter source may still pin a prebuilt bundle", () => {
  expect(
    gitAdapterSourceSchema.safeParse({
      commit: "a".repeat(40),
      integrity: "sha256-abc=",
      repository,
      source: "git",
    }).success,
  ).toBe(true);
});

test("the fields it does take are still checked", () => {
  expect(
    gitAdapterSourceSchema.safeParse({ commit: "abc", repository, source: "git" })
      .success,
  ).toBe(false);
  expect(
    gitAdapterSourceSchema.safeParse({ ref: "a b", repository, source: "git" })
      .success,
  ).toBe(false);
  expect(
    gitAdapterSourceSchema.safeParse({ repository: "https://evil.example", source: "git" })
      .success,
  ).toBe(false);
});
