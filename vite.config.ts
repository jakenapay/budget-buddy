import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";
import { SECURITY_HEADERS } from "./security-headers.ts";

// Must be a full file-system path. A root-relative "/src/..." works in the
// production build but not in the dev server's dependency pre-bundling,
// which reads it as the root of the drive (C:\src\...) and fails to start.
const emptyModule = fileURLToPath(new URL("./src/pdf/empty-module.ts", import.meta.url));
const page = (file: string): string => fileURLToPath(new URL(file, import.meta.url));

export default defineConfig({
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // Registers the service worker from a separate registerSW.js file, not
      // an inline <script>, so the CSP can stay script-src 'self'.
      injectRegister: "script",
      // Off in `npm run dev` so the dev server never serves stale cached files.
      devOptions: { enabled: false },
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Budget Buddy",
        short_name: "Budget Buddy",
        description: "Plan your payslip and track travel spending. Private: no account, works offline.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#fbf7f1",
        theme_color: "#1f5fbf",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Travel", url: "/travel", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
          { name: "Payslip", url: "/", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
          { name: "FAQ", url: "/faq", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        // Precache the whole app (every page, the lazy jsPDF chunk, the font)
        // so it opens abroad with no signal. Separate real pages, not a single-page
        // app: no navigateFallback; Workbox maps /travel to travel.html itself.
        globPatterns: ["**/*.{html,js,css,svg,png,woff2,webmanifest}"],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        // Exchange rates are never cached by the service worker: the app
        // keeps its own copy in IndexedDB with the date it was fetched.
        runtimeCaching: [],
      },
    }),
  ],
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
    rollupOptions: {
      input: { main: page("./index.html"), travel: page("./travel.html"), faq: page("./faq.html") },
    },
  },
  preview: { headers: SECURITY_HEADERS },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
