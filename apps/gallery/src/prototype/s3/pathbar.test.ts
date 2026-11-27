import { describe, expect, test } from "bun:test";
import { parseLocation } from "./pathbar";

describe("the path bar", () => {
  test("reads URIs, Spark schemes, ARNs and plain keys", () => {
    for (const text of [
      "s3://lake/a/b.csv",
      "s3a://lake/a/b.csv",
      "arn:aws:s3:::lake/a/b.csv",
    ])
      expect(parseLocation(text, "other")).toEqual({
        bucket: "lake",
        key: "a/b.csv",
      });
    expect(parseLocation("  /a/b/ ", "other")).toEqual({
      bucket: "other",
      key: "a/b/",
    });
    expect(parseLocation("s3://lake", "other")).toEqual({
      bucket: "lake",
      key: "",
    });
  });
});
