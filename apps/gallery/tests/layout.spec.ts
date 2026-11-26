import { expect, test } from "@playwright/test";
import { SCENARIOS } from "../../../packages/ui-fixtures/src/types";
import { manifest, openFixture, WIDTHS } from "./fixtures";
import { collapsedControls, overflowingPanes } from "./layout-checks";

for (const adapter of manifest)
  for (const { path, slug } of adapter.pages)
    for (const scenario of SCENARIOS)
      for (const width of WIDTHS)
        test(`${adapter.id} ${path} ${scenario} ${width}`, async ({ page }) => {
          const problems: string[] = [];
          page.on("pageerror", (error) => problems.push(error.message));
          page.on("console", (message) => {
            if (message.type() !== "error" && message.type() !== "warning")
              return;
            // Blocked external requests are the hermetic sandbox, not a bug.
            if (message.text().includes("net::ERR_FAILED")) return;
            problems.push(message.text());
          });
          await openFixture(page, {
            adapter: adapter.id,
            slug,
            scenario,
            width,
          });
          expect.soft(problems, "console and page errors").toEqual([]);
          expect
            .soft(await overflowingPanes(page), "horizontal overflow")
            .toEqual([]);
          expect
            .soft(await collapsedControls(page), "collapsed controls")
            .toEqual([]);
        });
