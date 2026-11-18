import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import c15t, { hosted, offline } from "c15t/astro";

// Offline mode keeps no consent records, so it is for `astro dev` only. Builds
// always use the hosted backend. Set C15T_MODE=hosted to test it locally.
const isDevelopment = process.argv.includes("dev");
const useOffline = isDevelopment && process.env.C15T_MODE !== "hosted";

export default defineConfig({
  site: "https://dsui.northgraindata.com",
  output: "static",
  build: { format: "directory" },
  integrations: [
    react(),
    useOffline
      ? c15t({ mode: offline() })
      : c15t({
          mode: hosted(),
          backendURL:
            process.env.PUBLIC_C15T_BACKEND_URL ??
            "https://dsui-northgraindata-com-dsui.inth.app",
          // The site is English only. Ignore the visitor's browser language so a
          // Polish browser never gets Polish banner copy from the backend.
          i18n: { locale: "en", detectLanguage: false },
        }),
  ],
  vite: {
    // Astro check prebundles production React; dev needs its own JSX runtime.
    cacheDir: `node_modules/.vite/${isDevelopment ? "dev" : "build"}`,
    plugins: [tailwindcss()],
  },
});
