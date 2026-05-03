import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standalone preview entry for the Map (今日舆图) feature.
// Runs independently of the main curation-app vite config —
// no Tauri, no auth, no backend — purely client-side mock data.

// In dev, vite normally serves /index.html for the root URL. Map lives
// at /index.map.html so the main app is untouched. This plugin rewrites
// the root request to the map entry so visitors landing on / see the map.
const rewriteRootToMap = () => ({
  name: "map-root-rewrite",
  configureServer(server: any) {
    server.middlewares.use((req: any, _res: any, next: any) => {
      if (req.url === "/" || req.url === "/index.html") {
        req.url = "/index.map.html";
      }
      next();
    });
  },
});

export default defineConfig({
  plugins: [react(), rewriteRootToMap()],
  define: {
    __IS_WEB__: true,
    __IS_TAURI__: false,
  },
  server: {
    port: 1421,
    strictPort: true,
  },
  build: {
    outDir: "dist-map",
    rollupOptions: {
      input: "index.map.html",
    },
  },
});
