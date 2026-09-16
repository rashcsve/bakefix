import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
  },
  resolve: {
    alias: {
      "@": import.meta.dirname,
    },
  },
});
