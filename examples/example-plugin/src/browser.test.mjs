import { expect, test } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createComponents } from "./browser.mjs";

test("custom plugin component renders with host React and escapes provider data", () => {
  const component = createComponents(React)["example-plugin/service-summary"];
  const html = renderToStaticMarkup(
    React.createElement(component, {
      node: {
        props: { props: { name: "<script>dbt</script>", adapter: "dbt" } },
      },
    }),
  );
  expect(html).toContain("&lt;script&gt;dbt&lt;/script&gt;");
  expect(html).not.toContain("<script>");
});
