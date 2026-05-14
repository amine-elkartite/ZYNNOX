import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  esbuild: {
    jsx: "automatic"
  },
  plugins: [react({ jsxRuntime: "automatic" })],
  test: {
    environment: "jsdom"
  }
});
