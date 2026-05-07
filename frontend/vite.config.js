import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";

export default defineConfig({
  // Use relative paths so the production build works under Electron's file:// protocol
  base: "./",
  plugins: [
    react(),
    legacy({
      targets: ["defaults", "not IE 11"]
    })
  ],
  server: {
    port: 5173
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});

