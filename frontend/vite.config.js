import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** SPA fallback for `vite preview` / Railway: deep links like /history must serve index.html */
function previewSpaFallback() {
  return {
    name: "preview-spa-fallback",
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") {
          next();
          return;
        }
        const raw = req.url || "";
        const pathOnly = raw.split("?")[0] ?? "";
        if (pathOnly.includes(".")) {
          next();
          return;
        }
        if (pathOnly.startsWith("/api")) {
          next();
          return;
        }
        const q = raw.includes("?") ? `?${raw.split("?").slice(1).join("?")}` : "";
        req.url = `/index.html${q}`;
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), previewSpaFallback()],
  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  preview: {
    allowedHosts: true,
  },
});
