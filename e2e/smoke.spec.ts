import { expect, test } from "@playwright/test";

test("dashboard renders the configured services", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /local trino/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /kafka/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /minio/i })).toBeVisible();
  await page.screenshot({
    path: "assets/screenshots/dashboard.png",
    fullPage: true,
  });
});

test("command palette is keyboard accessible", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Meta+k");
  await expect(
    page.getByRole("dialog", { name: "Command palette" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Command palette" }),
  ).toBeHidden();
});

test("marketing site and documentation landing pages render", async ({
  browser,
}) => {
  const site = await browser.newPage();
  await site.goto("http://127.0.0.1:4321");
  await expect(site.getByRole("heading").first()).toBeVisible();

  const docs = await browser.newPage();
  await docs.goto("http://127.0.0.1:4322/docs/");
  await expect(docs.getByRole("heading").first()).toBeVisible();
});
