import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      "client/dist/**",
      "server/data/**",
      "data/**",
      "my_model/**",
      "venv/**",
      ".venv/**",
      "__pycache__/**"
    ]
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
    }
  },
  {
    files: ["client/src/**/*.jsx"],
    rules: {
      "no-unused-vars": "off"
    }
  }
];
