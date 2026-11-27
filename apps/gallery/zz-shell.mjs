import { chromium } from "@playwright/test";

const out = process.argv[2];
const browser = await chromium.launch();
const visit = async (name, url, width = 1440, after) => {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning")
      errors.push(m.text().slice(0, 160));
  });
  await page.goto(`http://localhost:5180${url}`);
  await page.waitForTimeout(3500);
  if (after) await after(page);
  const info = await page.evaluate(() => ({
    path: location.pathname,
    overflow:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    alerts: [...document.querySelectorAll("[role=alert]")]
      .map((e) => e.textContent.trim().slice(0, 100))
      .filter(Boolean),
    text: document.body.innerText.length,
  }));
  console.log(
    name,
    JSON.stringify({ ...info, errors: [...new Set(errors)].slice(0, 4) }),
  );
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.close();
};
const runQuery = async (page) => {
  await page.locator(".dsui-sql-editor-wrap").first().click();
  await page.keyboard.type("SELECT * FROM orders;", { delay: 30 });
  await page.locator(".dsui-run-query").first().click();
  await page.waitForTimeout(1500);
  console.log(
    "  result:",
    JSON.stringify(
      (await page.locator(".dsui-query-results").first().innerText())
        .replace(/\n+/g, " | ")
        .slice(0, 220),
    ),
  );
};
await visit("index", "/");
await visit("app-home", "/?shell=1");
await visit("app-services", "/services?shell=1");
await visit("app-new", "/services/new?shell=1");
await visit("app-adapter", "/adapters/airflow?shell=1");
await visit("app-settings", "/settings?shell=1");
await visit("shell-pg", "/services/postgresql?scenario=default");
await visit(
  "shell-query",
  "/services/duckdb/query?scenario=default",
  1440,
  runQuery,
);
await visit(
  "page-query",
  "/?adapter=duckdb&page=query&scenario=default",
  1440,
  runQuery,
);
await visit("app-home-narrow", "/?shell=1", 390);
await browser.close();
