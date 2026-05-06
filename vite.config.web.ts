import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

const platform = (name: string) =>
  fileURLToPath(new URL(`./src/lib/platform/${name}`, import.meta.url));

export default defineConfig({
  plugins: [tailwindcss(), react()],
  define: {
    __IS_WEB__: true,
    __IS_TAURI__: false,
  },
  resolve: {
    alias: [
      { find: "@tauri-apps/api/core", replacement: platform("web-stubs/tauri-core.ts") },
      { find: "@tauri-apps/api/event", replacement: platform("web-stubs/tauri-event.ts") },
      { find: "@tauri-apps/api/app", replacement: platform("web-stubs/tauri-app.ts") },
      { find: "@tauri-apps/plugin-dialog", replacement: platform("web-stubs/tauri-dialog.ts") },
      { find: "@tauri-apps/plugin-process", replacement: platform("web-stubs/tauri-process.ts") },
      { find: "@tauri-apps/plugin-updater", replacement: platform("web-stubs/tauri-updater.ts") },
      { find: /\/src\/lib\/platform\/cache\.tauri(\.ts)?$/, replacement: platform("cache.web.ts") },
      { find: /\/src\/lib\/platform\/chat\.tauri(\.ts)?$/, replacement: platform("chat.web.ts") },
      { find: /\/src\/lib\/platform\/dialog\.tauri(\.ts)?$/, replacement: platform("dialog.web.ts") },
      { find: /\/src\/lib\/platform\/sync-event\.tauri(\.ts)?$/, replacement: platform("sync-event.web.ts") },
      { find: /\/src\/lib\/platform\/updater\.tauri(\.ts)?$/, replacement: platform("updater.web.ts") },
      { find: /\/src\/lib\/platform\/url-opener\.tauri(\.ts)?$/, replacement: platform("url-opener.web.ts") },
    ],
  },
  build: {
    outDir: "dist-web",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
