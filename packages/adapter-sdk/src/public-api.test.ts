import { expect, test } from "bun:test";

/**
 * Public API freeze: every runtime export of the package root.
 * Restructuring must not add, remove, or rename exports. Update this
 * list deliberately, in the same change as the API decision.
 */
const EXPECTED_EXPORTS = [
  "ADAPTER_SDK_VERSION",
  "Button",
  "CodeEditor",
  "Form",
  "InvalidDefinitionError",
  "KeyValue",
  "ManualRefreshPolicy",
  "PageHeader",
  "PollingRefreshPolicy",
  "RefreshPolicy",
  "SdkError",
  "Select",
  "Table",
  "Tabs",
  "TextInput",
  "UnknownPageError",
  "adapterManifestSchema",
  "createAdapterInstance",
  "createStoreInstance",
  "defineAction",
  "defineAdapter",
  "defineComponent",
  "definePage",
  "defineResource",
  "defineStore",
  "externalAdapterSourceSchema",
  "githubAdapterSourceSchema",
  "manual",
  "matchRoute",
  "npmAdapterSourceSchema",
  "poll",
  "resourceKey",
  "stableStringify",
  "validateArchiveEntries",
  "validateExternalSource",
  "validateManifest",
  "verifySriSha512",
  "z",
];

test("public API surface is frozen", async () => {
  const module = await import("./index");
  expect(Object.keys(module).sort()).toEqual(EXPECTED_EXPORTS);
});
