import { expect, test } from "@playwright/test";
import { manifest, openFixture } from "./fixtures";

// Opt in: baselines only mean something against a run on the same platform.
test.skip(!process.env.DSUI_VISUAL, "set DSUI_VISUAL=1 to compare screenshots");

for (const adapter of manifest)
  for (const { path, slug } of adapter.pages)
    for (const width of ["360", "1280", "split"] as const)
      test(`${adapter.id} ${path} looks unchanged at ${width}`, async ({
        page,
      }) => {
        await openFixture(page, {
          adapter: adapter.id,
          slug,
          scenario: "default",
          width,
        });
        await expect(page).toHaveScreenshot(
          `${adapter.id}--${slug}--${width}.png`,
          { fullPage: true },
        );
      });
