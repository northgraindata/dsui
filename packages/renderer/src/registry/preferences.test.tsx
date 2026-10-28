import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DisplayPreferencesContext,
  defaultDisplayPreferences,
  formatDisplayDate,
} from "../../../adapter-sdk/src/components/ui/preferences";
import { HighlightedSqlInput } from "../../../adapter-sdk/src/components/ui/query-editor/highlighted-sql-input";

test("shared SQL fallback consumes the host's editor preferences", () => {
  const html = renderToStaticMarkup(
    <DisplayPreferencesContext.Provider
      value={{
        ...defaultDisplayPreferences,
        editorFontSize: 18,
        editorWordWrap: true,
        editorTabSize: 4,
      }}
    >
      <HighlightedSqlInput
        value="SELECT 1"
        onChange={() => {
          throw new Error("Unexpected edit");
        }}
        onRun={() => {
          throw new Error("Unexpected query");
        }}
      />
    </DisplayPreferencesContext.Provider>,
  );
  expect(html).toContain("font-size:18px");
  expect(html).toContain("tab-size:4");
  expect(html).toContain('wrap="soft"');
});

test("timestamp formatting follows the selected time zone and keeps invalid values readable", () => {
  const time = "2026-10-18T12:00:00Z";
  expect(formatDisplayDate(time, { timeZone: "UTC", clock: "24h" })).not.toBe(
    formatDisplayDate(time, { timeZone: "America/New_York", clock: "24h" }),
  );
  expect(formatDisplayDate("not a timestamp", defaultDisplayPreferences)).toBe(
    "not a timestamp",
  );
});
