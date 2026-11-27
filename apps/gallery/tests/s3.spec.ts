import { expect, type Page, test } from "@playwright/test";

let problems: string[] = [];
test.beforeEach(({ page }) => {
  problems = [];
  page.on("pageerror", (error) => problems.push(error.message));
});
test.afterEach(() => {
  expect(problems).toEqual([]);
});

async function open(page: Page, path: string) {
  await page.goto(`/services/s3${path}?shell=1&design=new`);
  const view = page.locator(".ax-embedded-main");
  await view.locator("h1, .s3-browser").first().waitFor();
  return view;
}
const samples = "/buckets/acme-lake";

async function inSamples(page: Page) {
  const view = await open(page, samples);
  await view.getByRole("button", { name: "samples", exact: true }).click();
  await view
    .getByRole("button", { name: "customers.csv", exact: true })
    .waitFor();
  return view;
}

test("every sample file has an icon and a preview that fits the panel", async ({
  page,
}) => {
  const view = await inSamples(page);
  const rows = view.locator(".s3-rows .s3-row");
  const count = await rows.count();
  expect(count).toBeGreaterThan(18);
  await expect(view.locator(".s3-rows .s3-file-icon")).toHaveCount(count);
  const panel = view.locator(".s3-inspector");
  for (let index = 0; index < count; index += 1) {
    await rows.nth(index).locator(".s3-name > button").click();
    await expect(panel.locator(".s3-inspector-body > *").first()).toBeVisible();
    // Wide content scrolls in its own box and never widens the panel.
    expect(
      await panel
        .locator(".s3-inspector-body")
        .evaluate((body) => body.scrollWidth - body.clientWidth),
    ).toBeLessThanOrEqual(0);
  }
});

test("the keyboard walks files and previews, and goes up a folder", async ({
  page,
}) => {
  const view = await inSamples(page);
  const name = view.locator(".s3-inspector header strong");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await expect(name).toHaveText("README.md");
  await page.keyboard.press("ArrowDown");
  await expect(name).toHaveText("_SUCCESS");
  await page.keyboard.press("Escape");
  await expect(name).toHaveCount(0);
  await page.keyboard.press("x");
  await expect(view.locator(".s3-selection")).toContainText("1 selected");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Backspace");
  await expect(
    view.getByRole("button", { name: "samples", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("?");
  const shortcuts = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(shortcuts).toContainText("Go to a path");
  await page.keyboard.press("Escape");
  await expect(shortcuts).toHaveCount(0);
  await page.keyboard.press("/");
  await expect(view.getByLabel("Names starting with…")).toBeFocused();
});

test("a pasted URI opens its folder and the file", async ({ page }) => {
  const view = await open(page, samples);
  await view.getByRole("button", { name: "Type or paste a path (G)" }).click();
  const input = view.getByLabel("Go to S3 path");
  await input.fill("s3://nowhere/a");
  await input.press("Enter");
  await expect(view.locator(".s3-path small")).toHaveText(
    "No bucket named nowhere",
  );
  await input.fill("s3://acme-lake/samples/load_orders.py");
  await input.press("Enter");
  await expect(view.locator(".s3-inspector header strong")).toHaveText(
    "load_orders.py",
  );
});

test("a huge folder pages forward without claiming a total", async ({
  page,
}) => {
  const view = await open(page, samples);
  await view.getByRole("button", { name: "Type or paste a path (G)" }).click();
  await view.getByLabel("Go to S3 path").fill("raw/events/dt=2026-11-27/");
  await view.getByLabel("Go to S3 path").press("Enter");
  const pager = view.locator(".ax-pager > span").first();
  await expect(pager).toHaveText("Items 1–200 · more follow");
  await expect(view.locator(".s3-rows .s3-row")).toHaveCount(200);
  await view.getByRole("button", { name: "Next", exact: true }).click();
  await expect(pager).toHaveText("Items 201–400 · more follow");
  await view.getByRole("button", { name: /^Size/ }).click();
  await expect(view.locator(".ax-pager")).toContainText(
    "Sorted within this page only",
  );
  // Searching asks for names that start with the text, across the folder.
  await view.getByLabel("Names starting with…").fill("part-12000");
  await expect(view.locator(".s3-rows .s3-row")).toHaveCount(1);
});

test("selection, new folder, upload and delete change the list", async ({
  page,
}) => {
  const view = await inSamples(page);
  const rows = view.locator(".s3-rows .s3-row");
  const before = await rows.count();
  const top = await view.locator(".s3-listing").boundingBox();
  await view.getByLabel("Select README.md").click();
  await view
    .getByLabel("Select airflow-task.log")
    .click({ modifiers: ["Shift"] });
  await expect(view.locator(".s3-selection")).toContainText("4 selected");
  expect((await view.locator(".s3-listing").boundingBox())?.y).toBe(top?.y);
  await view.getByRole("button", { name: "Delete", exact: true }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Delete 4 items?");
  await confirm.getByRole("button", { name: "Delete" }).click();
  await expect(rows).toHaveCount(before - 4);

  await view.getByRole("button", { name: "New folder" }).click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Folder name").fill("a/b");
  await expect(
    modal.getByRole("button", { name: "Create folder" }),
  ).toBeDisabled();
  await modal.getByLabel("Folder name").fill("reports");
  await modal.getByRole("button", { name: "Create folder" }).click();
  await expect(rows).toHaveCount(before - 3);

  await view.locator('input[type="file"]').setInputFiles({
    name: "new.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("a,b\n1,2\n"),
  });
  await expect(
    view.getByRole("button", { name: "new.csv", exact: true }),
  ).toBeVisible({ timeout: 8000 });
});

test("the share dialog fits its window and states the risk", async ({
  page,
}) => {
  const view = await inSamples(page);
  await view
    .getByRole("button", { name: "customers.csv", exact: true })
    .click();
  await view.getByRole("button", { name: "Share", exact: true }).click();
  const modal = page.getByRole("dialog");
  await expect(modal).toContainText("Anyone who has the link can download");
  await modal.getByRole("button", { name: "7 days" }).click();
  await modal.getByRole("button", { name: "Create link" }).click();
  const box = await modal.boundingBox();
  for (const name of ["Close", "Create link"]) {
    const button = await modal
      .getByRole("button", { name, exact: true })
      .last()
      .boundingBox();
    expect(button).not.toBeNull();
    expect((button?.x ?? 0) + (button?.width ?? 0)).toBeLessThanOrEqual(
      (box?.x ?? 0) + (box?.width ?? 0),
    );
  }
  expect(
    await modal
      .locator(".s3-modal")
      .evaluate((body) => body.scrollWidth - body.clientWidth),
  ).toBeLessThanOrEqual(0);
});

test("a narrow window keeps every toolbar button clear of the list", async ({
  page,
}) => {
  for (const width of [900, 760, 560]) {
    await page.setViewportSize({ width, height: 800 });
    const view = await inSamples(page);
    const list = await view.locator(".s3-listing").boundingBox();
    for (const button of await view.locator(".s3-toolbar button").all()) {
      const box = await button.boundingBox();
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
        list?.y ?? 0,
      );
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
  }
});

test("the sidebar names the open bucket and switching keeps the view", async ({
  page,
}) => {
  await open(page, "/");
  const nav = page.locator(".ax-embedded-nav");
  await expect(nav.getByRole("button", { name: "Buckets" })).toBeVisible();
  // Nothing is open yet, so nothing claims to lead to a bucket's files.
  await expect(nav.getByRole("button", { name: "Files" })).toHaveCount(0);

  const view = page.locator(".ax-embedded-main");
  await view.getByRole("link", { name: /^acme-lake eu/ }).click();
  const trigger = nav.getByRole("button", {
    name: /^Open bucket: acme-lake\./,
  });
  await expect(trigger).toBeVisible();
  await nav.getByRole("button", { name: "Settings" }).click();
  await expect(
    view.getByRole("heading", { name: "Incomplete uploads" }),
  ).toBeVisible();

  await trigger.click();
  const search = nav.getByRole("combobox", { name: "Find a bucket to open" });
  await search.fill("exports");
  await search.press("Enter");
  await expect(view.locator("h1")).toHaveText("acme-exports");
  await expect(view).toContainText("No incomplete uploads in this bucket.");

  // The bucket stays named away from it.
  await nav.getByRole("button", { name: "Activity" }).click();
  await expect(
    nav.getByRole("button", { name: /^Open bucket: acme-exports\./ }),
  ).toBeVisible();
});

test("uploads stay in sight after leaving the folder", async ({ page }) => {
  const view = await inSamples(page);
  await view.locator('input[type="file"]').setInputFiles({
    name: "later.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("a\n1\n"),
  });
  const nav = page.locator(".ax-embedded-nav");
  await nav.getByRole("button", { name: "Activity" }).click();
  const tray = nav.getByRole("region", { name: "Uploads from this browser" });
  await expect(tray).toContainText("Uploaded 1 file", { timeout: 8000 });
  await tray.getByRole("button", { name: /later\.csv/ }).click();
  await expect(
    view.getByRole("button", { name: "later.csv", exact: true }),
  ).toBeVisible();
  await tray.getByRole("button", { name: "Clear" }).click();
  await expect(tray).toHaveCount(0);
});
