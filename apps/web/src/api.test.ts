import { describe, expect, it } from "vitest";
import { normalizeRenderer, titleFor } from "./api";

describe("adapter UI normalization", () => {
  it("maps the stable query kind to the core-owned workbench", () => {
    expect(normalizeRenderer("query")).toBe("query-workbench");
  });

  it("preserves supported declarative renderer kinds", () => {
    expect(normalizeRenderer("topic-browser")).toBe("topic-browser");
    expect(normalizeRenderer("object-browser")).toBe("object-browser");
  });

  it("fails safely to a generic record renderer for an unknown kind", () => {
    expect(normalizeRenderer("untrusted-react-component")).toBe("record-list");
  });

  it("uses practical titles for common capability IDs", () => {
    expect(titleFor("consumer-groups")).toBe("Consumer groups");
  });
});
