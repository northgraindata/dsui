import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import {
  rehypeCode,
  rehypeCodeDefaultOptions,
  remarkCodeTab,
  remarkHeading,
  remarkNpm,
  remarkStructure,
} from "fumadocs-core/mdx-plugins";
import { redirects } from "./src/lib/redirects.ts";

/** Exposes the fence language so the code block header can show it. */
const languageAttribute = {
  name: "dsui:language-attribute",
  pre(node) {
    node.properties["data-language"] = this.options.lang;
  },
};

/** Highlights lines named in the fence meta, for example ```ts {2,5-7}. */
const metaLineHighlight = {
  name: "dsui:meta-line-highlight",
  line(node, line) {
    const match = /\{([\d,\s-]+)\}/.exec(this.options.meta?.__raw ?? "");
    if (!match) return;
    const highlighted = match[1].split(",").some((range) => {
      const [from, to = from] = range.trim().split("-").map(Number);
      return line >= from && line <= to;
    });
    if (highlighted) this.addClassToHast(node, "highlighted");
  },
};

export default defineConfig({
  site: "https://dsui.northgraindata.com",
  base: "/docs",
  output: "static",
  // Astro prefixes the base to redirect sources but not to destinations.
  redirects: Object.fromEntries(
    Object.entries(redirects).map(([from, to]) => [from, `/docs${to}`]),
  ),
  markdown: {
    processor: unified({
      syntaxHighlight: false,
      remarkPlugins: [
        remarkHeading,
        remarkCodeTab,
        remarkNpm,
        [remarkStructure, { exportAs: "structuredData" }],
      ],
      rehypePlugins: [
        [
          rehypeCode,
          {
            ...rehypeCodeDefaultOptions,
            transformers: [
              ...(rehypeCodeDefaultOptions.transformers ?? []),
              languageAttribute,
              metaLineHighlight,
            ],
          },
        ],
      ],
    }),
  },
  integrations: [
    react(),
    mdx({ extendMarkdownConfig: true, syntaxHighlight: false }),
  ],
  vite: { plugins: [tailwindcss()] },
});
