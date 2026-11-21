import { readFileSync } from "node:fs";
import { proSuitePlugin } from "./pro-suite-plugin";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { adaptersPlugin } from "./adapters-plugin";
import { proPlugin } from "./pro-plugin";

const root = fileURLToPath(new URL("../..", import.meta.url));
export default defineConfig(({ mode }) => {
  const proDirectory =
    process.env.DSUI_PRO_DIR ??
    loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "DSUI_PRO_DIR")
      .DSUI_PRO_DIR;
  return {
    plugins: [
      tailwindcss(),
      react(),
      adaptersPlugin(),
      proPlugin(proDirectory),
      proSuitePlugin(proDirectory),
      {
        name: "lab-text-assets",
        load(id) {
          if (id.endsWith(".b64"))
            return `export default ${JSON.stringify(readFileSync(id, "utf8"))}`;
        },
      },
    ],
    optimizeDeps: {
      include: proDirectory
        ? [
            "lucide",
            "highlight.js/lib/core",
            "highlight.js/lib/languages/python",
            "highlight.js/lib/languages/sql",
            "highlight.js/lib/languages/json",
            "highlight.js/lib/languages/javascript",
            "highlight.js/lib/languages/bash",
          ]
        : [],
    },
    resolve: {
      dedupe: ["react", "react-dom", "lucide", "highlight.js", "zod"],
      alias: [
        {
          find: /^@northgraindata\/dsui-plugin-sdk$/,
          replacement: resolve(root, "packages/plugin-sdk/src/index.ts"),
        },
      ],
    },
    server: {
      port: 5175,
      fs: { allow: [root, ...(proDirectory ? [resolve(proDirectory)] : [])] },
    },
  };
});
