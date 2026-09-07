import { expect, test } from "bun:test";
import { InvalidDefinitionError, SdkError, UnknownPageError } from "./errors";

test("errors carry stable codes", () => {
  const invalid = new InvalidDefinitionError("bad id");
  expect(invalid).toBeInstanceOf(SdkError);
  expect(invalid).toBeInstanceOf(Error);
  expect(invalid.code).toBe("INVALID_DEFINITION");
  expect(invalid.message).toBe("bad id");

  const unknown = new UnknownPageError("/nope");
  expect(unknown.code).toBe("UNKNOWN_PAGE");
  expect(unknown.message).toBe("No page matches URL: /nope");
});
