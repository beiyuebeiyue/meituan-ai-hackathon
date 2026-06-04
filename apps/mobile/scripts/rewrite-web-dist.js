const fs = require("fs");
const path = require("path");

const distDir = path.resolve(__dirname, "..", "dist");
const targetExtensions = new Set([".html", ".js", ".css"]);

function rewriteFile(filePath) {
  const ext = path.extname(filePath);
  if (!targetExtensions.has(ext)) return;
  const original = fs.readFileSync(filePath, "utf8");
  const next = original
    .replace(/(["':])\/_expo\//g, "$1/mobile-expo/")
    .replace(/(["':])\/assets\//g, "$1/mobile-assets/")
    .replace(/(["':])\/favicon\.ico/g, "$1/mobile-favicon.ico");
  if (next !== original) {
    fs.writeFileSync(filePath, next);
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(entryPath);
    } else if (entry.isFile()) {
      rewriteFile(entryPath);
    }
  }
}

if (!fs.existsSync(distDir)) {
  throw new Error(`Missing Expo web dist directory: ${distDir}`);
}

walk(distDir);
