import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Checks the built site in dist/ for broken internal links and anchors, and
 * confirms that URLs other projects depend on still resolve.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(root, "dist");
const base = "/docs";

// Linked from apps/site, README.md, CONTRIBUTING.md, and release workflows.
const requiredUrls = [
  "/docs",
  "/docs/getting-started/quickstart",
  "/docs/getting-started/quickstart#docker-alternative",
  "/docs/adapter-sdk/overview",
  "/docs/plugin-sdk/overview",
  "/docs/adapter-sdk/release",
  "/docs/plugin-sdk/release",
  "/docs/telemetry",
  "/docs/contributing",
  // Moved pages: the old paths redirect.
  "/docs/adapters/dbt",
  "/docs/how-dsui-works",
  "/docs/troubleshooting",
  "/docs/dsui-agent",
  "/docs/adapter-sdk/components/button",
];

function listHtml(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listHtml(path);
    return name.endsWith(".html") ? [path] : [];
  });
}

function pageFile(pathname: string): string | null {
  const relative = pathname.replace(new RegExp(`^${base}/?`), "");
  const candidates = [
    join(distDir, relative, "index.html"),
    join(distDir, `${relative}.html`),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

const idCache = new Map<string, Set<string>>();

function idsIn(file: string): Set<string> {
  const cached = idCache.get(file);
  if (cached) return cached;
  const html = readFileSync(file, "utf8");
  const ids = new Set(
    [...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]),
  );
  idCache.set(file, ids);
  return ids;
}

function resolveUrl(url: string): string | null {
  const [withoutHash, hash] = url.split("#");
  const pathname = withoutHash.split("?")[0];
  if (/\.[a-z0-9]+$/i.test(pathname) && !pathname.endsWith(".html")) {
    const asset = join(distDir, pathname.replace(new RegExp(`^${base}/?`), ""));
    return existsSync(asset) ? null : `missing file ${pathname}`;
  }
  const file = pageFile(pathname);
  if (!file) return `no page for ${pathname}`;
  if (hash && !idsIn(file).has(decodeURIComponent(hash))) {
    return `no anchor #${hash} on ${pathname}`;
  }
  return null;
}

function internalLinks(file: string): string[] {
  const html = readFileSync(file, "utf8");
  return [...html.matchAll(/\shref=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((href) => href === base || href.startsWith(`${base}/`));
}

/** Static redirects are HTML pages with a meta refresh to the destination. */
function redirectTarget(file: string): string | null {
  const html = readFileSync(file, "utf8");
  const match = /http-equiv="refresh"\s+content="\d+;url=([^"]+)"/.exec(html);
  return match ? match[1] : null;
}

function problemsIn(file: string): string[] {
  const from = file.slice(distDir.length);
  const target = redirectTarget(file);
  if (target) {
    const problem = target.startsWith(`${base}/`)
      ? resolveUrl(target)
      : `redirect target ${target} is outside ${base}`;
    return problem ? [`${from}: ${problem}`] : [];
  }
  return [...new Set(internalLinks(file))].flatMap((href) => {
    const problem = resolveUrl(href);
    return problem ? [`${from}: ${problem}`] : [];
  });
}

function main(): number {
  if (!existsSync(distDir)) {
    console.error("dist/ not found, run the docs build first");
    return 1;
  }
  const files = listHtml(distDir);
  const problems = files.flatMap(problemsIn);
  for (const url of requiredUrls) {
    const problem = resolveUrl(url);
    if (problem) problems.push(`required URL: ${problem}`);
  }
  for (const problem of problems) console.error(problem);
  console.log(
    `check-links: ${files.length} pages, ${problems.length} problems`,
  );
  return problems.length === 0 ? 0 : 1;
}

process.exit(main());
