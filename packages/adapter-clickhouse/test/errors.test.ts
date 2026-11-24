import { expect, test } from "bun:test";
import { requestError } from "../src/errors.js";

test("explains ClickHouse date parsing errors without exposing the server message", () => {
  const error = requestError({ code: "38", message: "secret input value" });
  expect(error.message).toContain("could not parse a date");
  expect(error.message).toContain("date values and formats");
  expect(error.message).not.toContain("secret input value");
});
