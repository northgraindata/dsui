import type { APIRoute } from "astro";
import { markdownPages } from "@/lib/markdown";

const origin = "https://dsui.northgraindata.com";

export const GET: APIRoute = () => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const lines = markdownPages().map(
    (page) =>
      `- [${page.title}](${origin}${base}/${page.slug}.md): ${page.description}`,
  );
  const text = `# DSUI Docs\n\n> The AI-native control plane for your data stack.\n\n## Pages\n\n${lines.join("\n")}\n`;
  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
