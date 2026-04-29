import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standalone preview entry for the Atlas (今日舆图) feature.
// Runs independently of the main curation-app vite config —
// no Tauri, no auth, no backend — purely client-side mock data.

// In dev, vite normally serves /index.html for the root URL. Atlas lives
// at /index.atlas.html so the main app is untouched. This plugin rewrites
// the root request to the atlas entry so visitors landing on / see the map.
const rewriteRootToAtlas = () => ({
  name: "atlas-root-rewrite",
  configureServer(server: any) {
    server.middlewares.use((req: any, _res: any, next: any) => {
      if (req.url === "/" || req.url === "/index.html") {
        req.url = "/index.atlas.html";
      }
      next();
    });
  },
});

export default defineConfig({
  plugins: [react(), rewriteRootToAtlas()],
  define: {
    __IS_WEB__: true,
    __IS_TAURI__: false,
  },
  server: {
    port: 1421,
    strictPort: true,
  },
  build: {
    outDir: "dist-atlas",
    rollupOptions: {
      input: "index.atlas.html",
    },
  },
});
