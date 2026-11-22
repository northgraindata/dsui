import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  configSchema,
  type DsuiConfig,
} from "../../../packages/server/src/config";

/**
 * Validates every `dsui.yaml` snippet in the docs with the server's own schema.
 *
 * A snippet counts as a configuration when its top level has `adapters`,
 * `plugins`, or a `services` list. It must parse, and it must be complete: every service names an
 * adapter that the same snippet declares. Only `local` and `git` adapter
 * sources can be built, so `package` entries are rejected too.
 *
 * Pages in lint-content.baseline.json are not rewritten yet, so their
 * problems are warnings.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = join(root, "content", "docs");
const baselinePath = join(root, "scripts", "lint-content.baseline.json");

export interface Snippet {
  line: number;
  text: string;
}

export function yamlSnippets(source: string): Snippet[] {
  const snippets: Snippet[] = [];
  const lines = source.split("\n");
  let current: Snippet | null = null;
  lines.forEach((line, index) => {
    if (current) {
      if (/^\s*```\s*$/.test(line)) {
        snippets.push(current);
        current = null;
      } else {
        current.text += `${line}\n`;
      }
    } else if (/^\s*```ya?ml\b/.test(line)) {
      current = { line: index + 1, text: "" };
    }
  });
  return snippets;
}

export function configProblems(text: string): string[] {
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (error) {
    return [`invalid YAML: ${error instanceof Error ? error.message : error}`];
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  // A DSUI `services` is a list. Docker Compose also has `services`, as a map.
  const isDsui =
    "adapters" in raw ||
    "plugins" in raw ||
    ("services" in raw && Array.isArray(raw.services));
  if (!isDsui) return [];
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    return parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    );
  }
  return completenessProblems(parsed.data);
}

function completenessProblems(config: DsuiConfig): string[] {
  const problems: string[] = [];
  const adapters = config.adapters ?? {};
  for (const [id, entry] of Object.entries(adapters)) {
    if ("package" in entry) {
      problems.push(
        `adapters.${id}: package sources can't be loaded, use source: local or source: git`,
      );
    }
  }
  for (const service of config.services) {
    if (!(service.adapter in adapters)) {
      problems.push(
        `services.${service.id}: adapter "${service.adapter}" is not declared under adapters`,
      );
    }
  }
  return problems;
}

function listContentFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listContentFiles(path);
    return /\.mdx?$/.test(name) ? [path] : [];
  });
}

function main(): number {
  const baseline = new Set(
    JSON.parse(readFileSync(baselinePath, "utf8")) as string[],
  );
  let errors = 0;
  let warnings = 0;
  for (const file of listContentFiles(contentDir).sort()) {
    const path = relative(contentDir, file);
    for (const snippet of yamlSnippets(readFileSync(file, "utf8"))) {
      const problems = configProblems(snippet.text);
      for (const problem of problems) {
        if (baseline.has(path)) {
          warnings++;
        } else {
          console.error(`${path}:${snippet.line} - ${problem}`);
          errors++;
        }
      }
    }
  }
  console.log(
    `check-config-snippets: ${errors} errors, ${warnings} baseline warnings`,
  );
  return errors === 0 ? 0 : 1;
}

if (import.meta.main) process.exit(main());
