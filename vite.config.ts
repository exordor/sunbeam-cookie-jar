import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(__dirname, "popup.html"),
      output: {
        entryFileNames: "popup.js",
        chunkFileNames: "popup.js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) {
            return "popup.css";
          }
          return "assets/[name][extname]";
        }
      }
    }
  }
});
