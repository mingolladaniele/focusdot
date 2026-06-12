import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    port: 5173,
    // Must match src-tauri/tauri.conf.json devUrl; fail fast instead of silently using another port.
    strictPort: true
  },
  test: {
    globals: true,
    restoreMocks: true
  },
  build: {
    target: "es2022",
    minify: true
  }
});
