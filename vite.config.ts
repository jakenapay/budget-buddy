import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { SECURITY_HEADERS } from "./security-headers.ts";

// Must be a full file-system path. A root-relative "/src/..." works in the
// production build but not in the dev server's dependency pre-bundling,
// which reads it as the root of the drive (C:\src\...) and fails to start.
const emptyModule = fileURLToPath(new URL("./src/pdf/empty-module.ts", import.meta.url));

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    // jsPDF lazily imports these for .html() and SVG support, which we don't
    // use; point them at an empty module so they never ship.
    alias: Object.fromEntries(["html2canvas", "dompurify", "canvg"].map((name) => [name, emptyModule])),
  },
  build: {
    target: "es2022",
    // The polyfill would be the only reason to consider inline scripts; every
    // browser we target supports modulepreload natively.
    modulePreload: { polyfill: false },
  },
  preview: { headers: SECURITY_HEADERS },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
