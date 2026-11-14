import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

/**
 * Lints docs content against apps/docs/AGENTS.md.
 *
 * Pages that have not been rewritten yet are listed in
 * lint-content.baseline.json. Violations in those pages are reported as
 * warnings. Every rewrite pull request removes its pages from the baseline,
 * and a baseline entry for a clean page is an error, so the list only shrinks.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = join(root, "content", "docs");
const baselinePath = join(root, "scripts", "lint-content.baseline.json");

const contentTypes = [
  "tutorial",
  "how-to",
  "reference",
  "conceptual",
  "troubleshooting",
  "landing",
];
const bannedWords = [
  "easy",
  "easily",
  "simple",
  "simply",
  "quick",
  "quickly",
  "very",
  "just",
  "really",
  "obviously",
];
const properNouns = new Set([
  "DSUI",
  "Docker",
  "Compose",
  "DuckDB",
  "ClickHouse",
  "PostgreSQL",
  "Airflow",
  "S3",
  "GitHub",
  "GitLab",
  "Cloud",
  "Agent",
  "Agents",
  "Adapter",
  "Plugin",
  "SDK",
  "API",
  "CLI",
  "HTTP",
  "YAML",
  "SQL",
  "UI",
  "AI",
  "MDX",
  "TypeScript",
  "JavaScript",
  "Node.js",
  "Bun",
  "Settings",
  "Quack",
  "Cloudflare",
  "Azure",
  "Blob",
  "Google",
  "MinIO",
  "Kubernetes",
  "Linear",
  "Python",
]);

export interface Violation {
  line: number;
  rule: string;
  message: string;
}

interface Frontmatter {
  title?: unknown;
  description?: unknown;
  contentType?: unknown;
}

function splitFrontmatter(source: string): {
  data: Frontmatter | null;
  bodyStart: number;
} {
  if (!source.startsWith("---\n")) return { data: null, bodyStart: 0 };
  const end = source.indexOf("\n---", 4);
  if (end === -1) return { data: null, bodyStart: 0 };
  const raw = source.slice(4, end);
  const bodyStart = source.slice(0, end + 4).split("\n").length;
  try {
    return { data: (parseYaml(raw) as Frontmatter) ?? {}, bodyStart };
  } catch {
    return { data: null, bodyStart };
  }
}

function stripInlineCode(text: string): string {
  return text.replace(/`[^`]*`/g, "");
}

function isPlainParagraphLine(line: string): boolean {
  if (line.trim() === "") return false;
  if (/^\s/.test(line)) return false;
  return !/^(#|[-*+]\s|\d+[.)]\s|\||>|<|```|:::|!\[|\{)/.test(line);
}

function checkFrontmatter(data: Frontmatter | null): Violation[] {
  if (!data) {
    return [{ line: 1, rule: "frontmatter", message: "missing frontmatter" }];
  }
  const out: Violation[] = [];
  const fail = (message: string) =>
    out.push({ line: 1, rule: "frontmatter", message });
  if (typeof data.title !== "string" || data.title === "") {
    fail("title is required");
  }
  if (typeof data.description !== "string" || data.description === "") {
    fail("description is required");
  }
  if (
    typeof data.contentType !== "string" ||
    !contentTypes.includes(data.contentType.toLowerCase())
  ) {
    fail(`contentType must be one of: ${contentTypes.join(", ")}`);
  }
  return out;
}

function checkHeading(text: string, line: number): Violation[] {
  const words = stripInlineCode(text)
    .replace(/^\d+\.\s*/, "")
    .split(/\s+/)
    .filter(Boolean);
  const offender = words
    .slice(1)
    .find(
      (word) =>
        /^[A-Z][a-z]/.test(word) &&
        !properNouns.has(word.replace(/[^\w.]/g, "")),
    );
  if (!offender) return [];
  return [
    {
      line,
      rule: "heading-case",
      message: `use sentence case, "${offender}" is capitalized`,
    },
  ];
}

function checkProseLine(line: string, number: number): Violation[] {
  const out: Violation[] = [];
  const prose = stripInlineCode(line);
  const fail = (rule: string, message: string) =>
    out.push({ line: number, rule, message });
  for (const word of bannedWords) {
    if (new RegExp(`\\b${word}\\b`, "i").test(prose)) {
      fail("banned-word", `banned word "${word}"`);
    }
  }
  // The component named "Link" has its own page, so its name is a good anchor.
  const vague = /\[(here|link|this link|click here)\]\(([^)\s]*)\)/gi;
  for (const match of prose.matchAll(vague)) {
    if (!match[2].endsWith("/components/link")) {
      fail("link-text", "anchor text must name the destination");
    }
  }
  const withoutLinks = prose
    .replace(/\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/<https?:[^>]*>/g, "");
  if (/https?:\/\/\S+/.test(withoutLinks)) {
    fail("bare-url", "bare URL, use a link with descriptive anchor text");
  }
  return out;
}

function checkAnyLine(line: string, number: number): Violation[] {
  const out: Violation[] = [];
  if (line.includes("—")) {
    out.push({
      line: number,
      rule: "em-dash",
      message: "em dash, use a colon, comma, or period",
    });
  }
  if (/<[A-Z_]{3,}>|\bxxx+\b|\byour-[a-z]+(-[a-z]+)*\b|\bABC123\b/.test(line)) {
    out.push({
      line: number,
      rule: "placeholder",
      message: "placeholder must be descriptive snake_case",
    });
  }
  return out;
}

function checkInternalLinks(line: string, number: number): Violation[] {
  const out: Violation[] = [];
  for (const match of stripInlineCode(line).matchAll(
    /\]\((\/docs[^)\s]*)\)/g,
  )) {
    const target = match[1].split("#")[0].replace(/^\/docs\/?/, "");
    if (
      !pageExists(target) &&
      !assetExists(target) &&
      !componentPageExists(target)
    ) {
      out.push({
        line: number,
        rule: "broken-link",
        message: `no page at ${match[1]}`,
      });
    }
  }
  return out;
}

/** Component reference pages are generated from src/content/components. */
function componentPageExists(path: string): boolean {
  const match = /^build\/components\/([a-z0-9-]+)$/.exec(path);
  return (
    match !== null &&
    existsSync(join(root, "src", "content", "components", `${match[1]}.json`))
  );
}

function assetExists(path: string): boolean {
  return /\.[a-z0-9]+$/i.test(path) && existsSync(join(root, "public", path));
}

function pageExists(slug: string): boolean {
  const clean = slug.replace(/\/$/, "");
  const candidates = clean
    ? [`${clean}.mdx`, `${clean}.md`, join(clean, "index.mdx")]
    : ["index.mdx"];
  return candidates.some((candidate) => {
    try {
      return statSync(join(contentDir, candidate)).isFile();
    } catch {
      return false;
    }
  });
}

function checkFence(line: string, number: number, inFence: boolean) {
  if (inFence || !/^\s*```\s*$/.test(line)) return [];
  return [
    {
      line: number,
      rule: "code-language",
      message: "code block needs a language tag",
    },
  ];
}

function checkStructure(line: string, number: number): Violation[] {
  const out: Violation[] = [];
  if (/^---+\s*$/.test(line)) {
    out.push({
      line: number,
      rule: "horizontal-rule",
      message: "no horizontal rules, use headings",
    });
  }
  const heading = /^(#{1,6})\s+(.*)$/.exec(line);
  if (heading) {
    if (heading[1].length === 1) {
      out.push({
        line: number,
        rule: "h1",
        message: "no H1 in the body, the title frontmatter is the H1",
      });
    }
    out.push(...checkHeading(heading[2], number));
  }
  return out;
}

export function lintSource(source: string): Violation[] {
  const { data, bodyStart } = splitFrontmatter(source);
  const lines = source.split("\n");
  const out = checkFrontmatter(data);
  let inFence = false;
  let previousPlain = false;
  for (let index = bodyStart; index < lines.length; index++) {
    const line = lines[index];
    const number = index + 1;
    if (/^\s*```/.test(line)) {
      out.push(...checkFence(line, number, inFence));
      inFence = !inFence;
      previousPlain = false;
      continue;
    }
    out.push(...checkAnyLine(line, number));
    if (inFence) continue;
    out.push(...checkStructure(line, number));
    out.push(...checkProseLine(line, number));
    out.push(...checkInternalLinks(line, number));
    const plain = isPlainParagraphLine(line);
    if (plain && previousPlain) {
      out.push({
        line: number,
        rule: "hard-wrap",
        message: "paragraph is wrapped, write each paragraph on one line",
      });
    }
    previousPlain = plain;
  }
  return out;
}

/** Joins hard-wrapped paragraph lines so each paragraph is one source line. */
export function unwrapSource(source: string): string {
  const { bodyStart } = splitFrontmatter(source);
  const lines = source.split("\n");
  const out: string[] = lines.slice(0, bodyStart);
  let inFence = false;
  let previousPlain = false;
  for (const line of lines.slice(bodyStart)) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      out.push(line);
      previousPlain = false;
      continue;
    }
    const plain = !inFence && isPlainParagraphLine(line);
    if (plain && previousPlain) {
      out[out.length - 1] = `${out[out.length - 1]} ${line.trim()}`;
    } else {
      out.push(line);
    }
    previousPlain = plain;
  }
  return out.join("\n");
}

function listContentFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listContentFiles(path);
    return /\.mdx?$/.test(name) ? [path] : [];
  });
}

function loadBaseline(): Set<string> {
  try {
    return new Set(JSON.parse(readFileSync(baselinePath, "utf8")) as string[]);
  } catch {
    return new Set();
  }
}

function fix(paths: string[]): number {
  const files =
    paths.length > 0
      ? paths.map((path) => resolve(path))
      : listContentFiles(contentDir);
  for (const file of files) {
    const before = readFileSync(file, "utf8");
    const after = unwrapSource(before);
    if (after !== before) {
      writeFileSync(file, after);
      console.log(`unwrapped ${relative(process.cwd(), file)}`);
    }
  }
  return 0;
}

function main(): number {
  const baseline = loadBaseline();
  const files = listContentFiles(contentDir).sort();
  let errors = 0;
  let warnings = 0;
  for (const file of files) {
    const path = relative(contentDir, file);
    const violations = lintSource(readFileSync(file, "utf8"));
    const exempt = baseline.has(path);
    if (exempt && violations.length === 0) {
      console.error(
        `${path}: clean, remove it from lint-content.baseline.json`,
      );
      errors++;
      continue;
    }
    for (const v of violations) {
      const text = `${path}:${v.line} - ${v.message} (${v.rule})`;
      if (exempt) {
        warnings++;
      } else {
        console.error(text);
        errors++;
      }
    }
  }
  for (const path of baseline) {
    if (!files.some((file) => relative(contentDir, file) === path)) {
      console.error(`${path}: in baseline but the page no longer exists`);
      errors++;
    }
  }
  console.log(
    `lint-content: ${files.length} pages, ${errors} errors, ${warnings} baseline warnings`,
  );
  return errors === 0 ? 0 : 1;
}

if (import.meta.main) {
  const [flag, ...paths] = process.argv.slice(2);
  process.exit(flag === "--fix" ? fix(paths) : main());
}
