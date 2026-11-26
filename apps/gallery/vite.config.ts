import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  // The shell renders the real web app, so it serves that app's static files
  // and must share one React copy with it.
  publicDir: "../web/public",
  resolve: { dedupe: ["react", "react-dom"] },
  // The app is loaded on demand. Without it here, the first visit makes Vite
  // re-bundle dependencies mid-session, which loads a second React.
  optimizeDeps: {
    entries: ["index.html", "../web/src/main.tsx", "src/harness/select.tsx"],
  },
  server: { port: 5180, strictPort: true },
  preview: { port: 5180, strictPort: true },
});
