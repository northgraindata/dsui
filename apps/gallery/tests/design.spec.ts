import { expect, test } from "@playwright/test";
import {
  stateName,
  TASK_STATES,
} from "../../../packages/adapter-airflow/src/states";

test("the Airflow redesign switches in place inside the shell", async ({
  page,
}) => {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));

  await page.goto("/services/airflow/dags?shell=1&design=old");
  const oldMenu = page.locator(".adapter-pages");
  await expect(oldMenu).toBeVisible();
  // Survives only while the document is never reloaded.
  await page.evaluate(() => Object.assign(window, { stayed: true }));
  const choose = (name: string) =>
    page.getByRole("button", { name, exact: true }).click();
  const newMenu = page.locator(".ax-embedded-nav");

  await choose("New");
  await expect(newMenu).toBeVisible();
  await expect(oldMenu).toBeHidden();
  await expect(page.locator(".adapter-back")).toBeVisible();
  await expect(page.locator(".ax-embedded-main h1")).toHaveText("DAGs");

  await newMenu.getByRole("button", { name: /^Pools/ }).click();
  await expect(page).toHaveURL(/\/services\/airflow\/pools$/);
  await expect(page.locator(".ax-embedded-main h1")).toHaveText("Pools");

  await choose("Old");
  await expect(oldMenu).toBeVisible();
  await expect(newMenu).toHaveCount(0);
  await expect(page.locator(".app-content .dsui-page h1").first()).toHaveText(
    "Pools",
  );

  await choose("New");
  await page.goBack();
  await expect(page.locator(".ax-embedded-main h1")).toHaveText("DAGs");

  // A page only the redesign has keeps showing when its address is shared.
  await newMenu.getByRole("button", { name: /^Runs/ }).click();
  await expect(page.locator(".ax-embedded-main h1")).toHaveText("Runs");
  await expect(page).toHaveURL(/\/services\/airflow\/dags(\?|$)/);
  await page.waitForTimeout(700);
  await expect(page.locator(".ax-embedded-main h1")).toHaveText("Runs");

  expect(await page.evaluate(() => "stayed" in window)).toBe(true);
  expect(problems).toEqual([]);
});

test("long lists page, filter and remember where you were", async ({
  page,
}) => {
  await page.goto("/services/airflow/dags?shell=1&design=new");
  const view = page.locator(".ax-embedded-main");
  const pager = view.locator(".ax-pager > span").first();
  await expect(pager).toHaveText("1–25 of 165");
  await view.getByRole("button", { name: "Next page" }).click();
  await expect(pager).toHaveText("26–50 of 165");

  await view.getByRole("button", { name: /^Paused/ }).click();
  await expect(pager).toHaveText(/^1–15 of 15$/);
  await view.getByLabel("Search DAGs").fill("export_to_s3");
  await expect(pager).toHaveText("1–1 of 1");

  await view.getByRole("link").first().click();
  await expect(view.locator("h1")).toHaveText("export_to_s3");
  await view.locator(".ax-crumbs").getByRole("button").click();
  await expect(view.getByLabel("Search DAGs")).toHaveValue("export_to_s3");

  await page
    .locator(".ax-embedded-nav")
    .getByRole("button", { name: "Home" })
    .click();
  await view.getByRole("button", { name: /Show all \d+ failing DAGs/ }).click();
  await expect(pager).toHaveText(/^1–(\d+) of \1$/);
  await expect(
    view
      .getByRole("group", { name: "Latest run" })
      .getByRole("button", { name: /^Failed/ }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("the overview says so when nothing is failing", async ({ page }) => {
  await page.goto("/services/airflow?shell=1&design=new");
  const view = page.locator(".ax-embedded-main");
  await expect(
    view.getByRole("heading", { name: "Failing now" }),
  ).toBeVisible();
  await page.getByLabel("Failures").selectOption("none");
  await expect(
    view.getByRole("heading", { name: "No DAG is failing" }),
  ).toBeVisible();
  await expect(view.getByRole("heading", { name: "Failing now" })).toHaveCount(
    0,
  );
});

test("run history shows when and how long, and long tags stay one row", async ({
  page,
}) => {
  await page.goto("/services/airflow/dags/daily_revenue?shell=1&design=new");
  const view = page.locator(".ax-embedded-main");
  const tip = page.locator(".ax-tip");
  await view.locator(".ax-grid-bar").nth(10).hover();
  await expect(tip).toContainText(/Started.*\d\d:\d\d:\d\d/);
  await expect(tip).toContainText(/Duration\s*\d\d:\d\d:\d\d/);
  // A daily schedule keeps its hour, also across the clock change.
  for (const time of await view.locator(".ax-grid-time time").allInnerTexts())
    expect(time).toMatch(/ 05:00:\d\d$/);
  expect(
    await view.locator(".ax-grid-time time").count(),
  ).toBeGreaterThanOrEqual(3);

  await view.getByRole("tab", { name: "Activity" }).click();
  await expect(view.locator(".ax-pager > span").first()).toContainText(
    "1–25 of",
  );
  await expect(view.locator(".ax-thead")).not.toContainText("DAG");

  await view.locator(".ax-crumbs").getByRole("button").click();
  await view.getByLabel("Search DAGs").fill("daily_revenue");
  await view.getByRole("button", { name: /^3 more tags/ }).hover();
  await expect(page.getByRole("tooltip")).toContainText("sox");
  await view.locator(".ax-strip i").last().hover();
  await expect(tip).toContainText("Today 05:00:");
});

test("the overview lists at most three failures", async ({ page }) => {
  await page.goto("/services/airflow?shell=1&design=new");
  await expect(page.locator(".ax-failures article")).toHaveCount(3);
});

test("the grid draws and explains every task state", async ({ page }) => {
  await page.goto("/services/airflow/dags/state_showcase?shell=1&design=new");
  const grid = page.locator(".ax-embedded-main .ax-grid-scroll");
  const legend = grid.locator(".ax-grid-legend li");
  await expect(legend).toHaveText(TASK_STATES.map((state) => stateName(state)));
  // No two states look alike: each differs in colour, outline or fill.
  const looks = await legend.locator(".ax-cell-mark").evaluateAll((marks) =>
    marks.map((mark) => {
      const style = getComputedStyle(mark);
      return [
        style.backgroundColor,
        style.borderColor,
        style.borderStyle,
      ].join();
    }),
  );
  expect(new Set(looks).size).toBe(TASK_STATES.length);
});

test("connection types read as product names with their logos", async ({
  page,
}) => {
  await page.goto("/services/airflow/connections?shell=1&design=new");
  const view = page.locator(".ax-embedded-main");
  await view.getByRole("combobox", { name: "All types" }).click();
  const options = page.getByRole("option");
  await expect(options.filter({ hasText: "Amazon Web Services" })).toHaveCount(
    1,
  );
  for (const name of await options.allInnerTexts())
    expect(name).not.toContain("_");
  await expect(options.locator(".ax-mark")).toHaveCount(await options.count());
  const cut = await options
    .locator(".dsui-select-copy strong")
    .evaluateAll(
      (names) =>
        names.filter((name) => name.scrollWidth > name.clientWidth).length,
    );
  expect(cut).toBe(0);
  await options.filter({ hasText: "Google Cloud Platform" }).click();
  for (const type of await view
    .locator(".ax-conn-table .ax-tr > span:nth-child(2)")
    .allInnerTexts())
    expect(type).toBe("Google Cloud Platform");
});

test("the overview opens no failure until asked, inside one card", async ({
  page,
}) => {
  await page.goto("/services/airflow?shell=1&design=new");
  const card = page.locator(".ax-failures");
  await expect(card.locator("article")).toHaveCount(3);
  await expect(card.locator("pre")).toHaveCount(0);
  await expect(card).toHaveCSS("border-top-width", "1px");
  await card.locator(".ax-failure-main").first().click();
  await expect(card.locator("pre")).toHaveCount(1);
});
