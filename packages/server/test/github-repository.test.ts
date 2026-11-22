import { describe, expect, test } from "bun:test";
import { githubRepository } from "../src/github-repository";

describe("githubRepository", () => {
  test("accepts owner/name and the git+https spelling, with or without .git", () => {
    expect(githubRepository("northgraindata/dsui")).toBe("northgraindata/dsui");
    expect(githubRepository("git+https://github.com/northgraindata/dsui")).toBe(
      "northgraindata/dsui",
    );
    expect(
      githubRepository("git+https://github.com/northgraindata/dsui.git"),
    ).toBe("northgraindata/dsui");
  });

  test("rejects anything that is not a single owner and name", () => {
    for (const spelling of [
      "dsui",
      "a/b/c",
      "",
      "/dsui",
      "git+https://gitlab.com/a/b",
    ])
      expect(githubRepository(spelling)).toBeNull();
  });
});
