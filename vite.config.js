import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync, statSync } from "fs";
import { join, extname } from "path";

const MIME = {
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export default defineConfig({
  plugins: [
    react(),
    {
      name: "serve-data-dir",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (!req.url.startsWith("/data/")) return next();
          const filePath = join(process.cwd(), req.url);
          if (existsSync(filePath) && statSync(filePath).isFile()) {
            const ext = extname(filePath);
            res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
            res.end(readFileSync(filePath));
          } else {
            res.statusCode = 404;
            res.end("Not found");
          }
        });
      },
    },
  ],
  resolve: {
    alias: { "@": "/src" },
  },
});
