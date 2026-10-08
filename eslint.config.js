import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: globals.browser },
    rules: {
      // User text must never reach the DOM as HTML (CLAUDE.md, Privacy and security).
      "no-restricted-properties": [
        "error",
        { property: "innerHTML", message: "Use textContent or el() from src/ui/dom.ts." },
        { property: "outerHTML", message: "Use textContent or el() from src/ui/dom.ts." },
        { property: "insertAdjacentHTML", message: "Use el() from src/ui/dom.ts." },
      ],
      // No persistence by default: nothing may be written to device storage.
      "no-restricted-globals": [
        "error",
        { name: "localStorage", message: "No persistence (CLAUDE.md)." },
        { name: "sessionStorage", message: "No persistence (CLAUDE.md)." },
        { name: "indexedDB", message: "No persistence (CLAUDE.md). Travel storage goes through src/travel/db.ts." },
      ],
    },
  },
  {
    // The single, reviewed exception: the Travel page saves trips in IndexedDB.
    files: ["src/travel/db.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "localStorage", message: "Travel data lives in IndexedDB only." },
        { name: "sessionStorage", message: "Travel data lives in IndexedDB only." },
      ],
    },
  },
);
