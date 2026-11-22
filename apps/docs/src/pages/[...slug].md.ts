import type { APIRoute } from "astro";
import { markdownPages, toMarkdown } from "@/lib/markdown";

export function getStaticPaths() {
  return markdownPages().map((page) => ({
    params: { slug: page.slug },
    props: { page },
  }));
}

export const GET: APIRoute = ({ props }) =>
  new Response(toMarkdown(props.page), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
