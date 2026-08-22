import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://dsui.northgraindata.com",
  output: "static",
  build: { format: "directory" },
  vite: { plugins: [tailwindcss()] },
});
