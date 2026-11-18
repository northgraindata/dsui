import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.DSUI_WEB_BASE_PATH ?? "/",
  plugins: [tailwindcss(), react()],
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:4192" } },
});
