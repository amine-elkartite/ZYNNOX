import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  esbuild: {
    jsx: "automatic"
  },
  plugins: [react({ jsxRuntime: "automatic" })]
});
