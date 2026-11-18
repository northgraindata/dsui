import { describe, expect, test } from "bun:test";
import { gitAdapterSourceSchema } from "../src/config";

const source = {
  source: "git",
  repository: "git+https://github.com/northgraindata/dsui",
  ref: "main",
  path: "packages/adapter-postgresql",
};
const commit = "a".repeat(40);
const integrity = "sha256-YWJj";

describe("git adapter source", () => {
  test("accepts source builds without bundle metadata", () => {
    expect(gitAdapterSourceSchema.safeParse(source).success).toBe(true);
  });

  test("accepts pinned bundles with both commit and integrity", () => {
    expect(
      gitAdapterSourceSchema.safeParse({ ...source, commit, integrity })
        .success,
    ).toBe(true);
  });

  test("rejects incomplete pinned bundle metadata", () => {
    expect(
      gitAdapterSourceSchema.safeParse({ ...source, commit }).success,
    ).toBe(false);
    expect(
      gitAdapterSourceSchema.safeParse({ ...source, integrity }).success,
    ).toBe(false);
  });
});
