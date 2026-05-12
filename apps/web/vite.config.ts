import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Load .env.local from the monorepo root (three levels up from core/apps/web/)
  envDir: "../../../",
  plugins: [
    tanstackStart({ target: "node-server" }),
    viteReact(),
    tailwindcss(),
  ],
  ssr: {
    // Workspace packages that export raw TS source must be bundled,
    // not externalized, so the SSR server output is self-contained.
    noExternal: ["@gitvisor/ui", "@gitvisor/shared"],
  },
  // Dev-only: proxy /api/* → local API so the dev server behaves the same
  // as the production server-start.mjs proxy.
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3002",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
