import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import type { ManifestAdapter } from "../src/data";

export const manifest: ManifestAdapter[] = JSON.parse(
  readFileSync(
    join(import.meta.dirname, "../.generated/manifest.json"),
    "utf8",
  ),
);

export const WIDTHS = ["360", "768", "1280", "split"] as const;
export type Width = (typeof WIDTHS)[number];

const SPLIT_VIEWPORT = 1440;

export async function openFixture(
  page: Page,
  target: { adapter: string; slug: string; scenario: string; width: Width },
): Promise<void> {
  const width =
    target.width === "split" ? SPLIT_VIEWPORT : Number(target.width);
  await page.setViewportSize({ width, height: 900 });
  // Relative timestamps must not change between runs.
  await page.clock.setFixedTime(new Date("2026-02-01T12:00:00Z"));
  // Fixtures are hermetic: nothing outside the gallery may be fetched.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  const search = new URLSearchParams({
    adapter: target.adapter,
    page: target.slug,
    scenario: target.scenario,
    width: target.width,
    toolbar: "0",
  });
  await page.goto(`/?${search}`);
  await page.locator("[data-gallery-ready]").waitFor();
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((done) =>
      requestAnimationFrame(() => requestAnimationFrame(done)),
    );
  });
}
