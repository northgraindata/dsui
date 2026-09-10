import { expect, test } from "bun:test";
import { registerFirstPartyViews } from "./first-party-registry";
import {
  clearViews,
  registerLazyView,
  registerView,
  resolveView,
} from "./view-registry";

function Probe() {
  return null;
}

test("registry resolves sync views and misses unknown ids", () => {
  clearViews();
  try {
    expect(resolveView("duckdb/table-card")).toBeNull();
    registerView("duckdb/table-card", Probe);
    expect(resolveView("duckdb/table-card")).toEqual({
      type: "sync",
      view: Probe,
    });
  } finally {
    clearViews();
  }
});

test("registry stores lazy loaders and overwrites on re-register", () => {
  clearViews();
  try {
    const loader = () => Promise.resolve({ default: Probe });
    registerLazyView("duckdb/table-card", loader);
    expect(resolveView("duckdb/table-card")).toEqual({
      type: "lazy",
      loader,
    });
    registerView("duckdb/table-card", Probe);
    expect(resolveView("duckdb/table-card")?.type).toBe("sync");
  } finally {
    clearViews();
  }
});

test("first-party views are registered from one explicit table", () => {
  clearViews();
  try {
    registerFirstPartyViews();
    for (const id of [
      "button",
      "form",
      "table",
      "tabs",
      "query-editor",
      "entity-catalog",
      "columns",
    ]) {
      expect(resolveView(id)?.type).toBe("sync");
    }
  } finally {
    clearViews();
  }
});
