import type { APIRoute } from "astro";
import { markdownPages, toMarkdown } from "@/lib/markdown";

export const GET: APIRoute = () =>
  new Response(markdownPages().map(toMarkdown).join("\n---\n\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
