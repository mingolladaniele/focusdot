import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    restoreMocks: true
  },
  build: {
    target: "es2022",
    minify: true
  }
});
