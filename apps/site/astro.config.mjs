import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://dsui.northgraindata.com",
  output: "static",
  build: { format: "directory" },
  vite: { plugins: [tailwindcss()] },
});
