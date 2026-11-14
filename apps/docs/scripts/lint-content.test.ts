import { describe, expect, test } from "bun:test";
import { lintSource, unwrapSource } from "./lint-content";

const frontmatter = `---
title: Connect a service
description: Add a service to your workspace.
contentType: how-to
---
`;

function rules(body: string): string[] {
  return lintSource(`${frontmatter}${body}`).map((v) => v.rule);
}

describe("lintSource", () => {
  test("accepts a clean page", () => {
    const body = [
      "Add a service in `dsui.yaml`.",
      "",
      "## Add the adapter",
      "",
      "```yaml",
      "services: []",
      "```",
      "",
    ].join("\n");
    expect(rules(body)).toEqual([]);
  });

  test("requires frontmatter fields", () => {
    const violations = lintSource("---\ntitle: Page\n---\nBody.\n");
    expect(violations.map((v) => v.message)).toEqual([
      "description is required",
      "contentType must be one of: tutorial, how-to, reference, conceptual, troubleshooting, landing",
    ]);
  });

  test("flags em dashes, even in code", () => {
    expect(rules("Use this — now.\n")).toContain("em-dash");
    expect(rules("```text\na — b\n```\n")).toContain("em-dash");
  });

  test("flags banned words outside code", () => {
    expect(rules("This is easy.\n")).toContain("banned-word");
    expect(rules("Use `just` here.\n")).not.toContain("banned-word");
    expect(rules("```text\njust run it\n```\n")).not.toContain("banned-word");
  });

  test("flags a code fence without a language", () => {
    expect(rules("```\nplain\n```\n")).toContain("code-language");
    expect(rules("```text\nplain\n```\n")).not.toContain("code-language");
  });

  test("flags hard-wrapped paragraphs but not lists", () => {
    expect(rules("First line.\nSecond line.\n")).toContain("hard-wrap");
    expect(rules("- one\n- two\n")).not.toContain("hard-wrap");
    expect(rules("One.\n\nTwo.\n")).not.toContain("hard-wrap");
  });

  test("flags non-sentence-case headings and keeps proper nouns", () => {
    expect(rules("## Configure Environment Variables\n")).toContain(
      "heading-case",
    );
    expect(rules("## Connect DuckDB to Docker Compose\n")).not.toContain(
      "heading-case",
    );
  });

  test("flags H1, horizontal rules, and bare URLs", () => {
    expect(rules("# Title\n")).toContain("h1");
    expect(rules("Text.\n\n---\n\nMore.\n")).toContain("horizontal-rule");
    expect(rules("See https://example.com now.\n")).toContain("bare-url");
    expect(rules("See [the guide](https://example.com).\n")).not.toContain(
      "bare-url",
    );
  });

  test("flags vague anchor text and bad placeholders", () => {
    expect(rules("Read [here](/docs).\n")).toContain("link-text");
    expect(rules("Set `<TOKEN>` first.\n")).toContain("placeholder");
    expect(rules("Set `your_access_token_here` first.\n")).not.toContain(
      "placeholder",
    );
  });

  test("accepts generated component pages and the Link component name", () => {
    expect(rules("See [Grid](/docs/build/components/grid).\n")).toEqual([]);
    expect(rules("See [Link](/docs/build/components/link).\n")).toEqual([]);
    expect(rules("See [Nope](/docs/build/components/nope).\n")).toContain(
      "broken-link",
    );
  });

  test("flags links to pages that do not exist", () => {
    expect(rules("See [a page](/docs/no/such/page).\n")).toContain(
      "broken-link",
    );
  });
});

describe("unwrapSource", () => {
  test("joins wrapped paragraphs and leaves code, lists, and components alone", () => {
    const input = `${frontmatter}First line.\nSecond line.\n\n- one\n- two\n\n<Callout>\nInside.\nMore.\n</Callout>\n\n\`\`\`ts\na\nb\n\`\`\`\n`;
    expect(unwrapSource(input)).toBe(
      `${frontmatter}First line. Second line.\n\n- one\n- two\n\n<Callout>\nInside. More.\n</Callout>\n\n\`\`\`ts\na\nb\n\`\`\`\n`,
    );
  });
});
