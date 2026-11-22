import { source } from "./source";

export interface MarkdownPage {
  slug: string;
  url: string;
  title: string;
  description: string;
  body: string;
}

/** Real MDX pages only: the generated component pages have no source body. */
export function markdownPages(): MarkdownPage[] {
  return source
    .getPages()
    .filter((page) => page.data._raw.digest !== "")
    .map((page) => ({
      slug: page.slugs.join("/") || "index",
      url: page.url,
      title: page.data.title,
      description: page.data.description ?? "",
      body: page.data._raw.body ?? "",
    }));
}

export function toMarkdown(page: MarkdownPage): string {
  const summary = page.description ? `\n\n> ${page.description}` : "";
  return `# ${page.title}${summary}\n\n${page.body.trim()}\n`;
}
