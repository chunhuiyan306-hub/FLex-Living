/**
 * Copy pdf.worker.min.mjs next to the app shell so Pdf.js loads the worker same-origin.
 * Runs on postinstall/predev/prebuild; safe no-op when node_modules missing.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(
  root,
  "node_modules",
  "pdfjs-dist",
  "build",
  "pdf.worker.min.mjs",
);
const destDir = path.join(root, "public");
const dest = path.join(destDir, "pdf.worker.min.mjs");

try {
  if (!fs.existsSync(src)) {
    console.warn("[copy-pdf-worker] skipped: pdfjs-dist not installed yet.");
    process.exit(0);
  }
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
  console.info("[copy-pdf-worker] public/pdf.worker.min.mjs");
} catch (err) {
  console.error("[copy-pdf-worker]", err.message);
  process.exit(1);
}
