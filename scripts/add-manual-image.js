/**
 * add-manual-image.js
 * ───────────────────
 * Manually add or override an artist image URL in the manifest.
 * Useful for the handful of artists Deezer doesn't have.
 *
 * Usage:
 *   node scripts/add-manual-image.js "Artist Name" "https://image-url.jpg"
 *
 * Examples:
 *   node scripts/add-manual-image.js "Georges St-Pierre" "https://example.com/gsp.jpg"
 *   node scripts/add-manual-image.js "Victoria Stilwell" "https://example.com/vs.jpg"
 */

const fs = require("fs");
const path = require("path");

const MANIFEST_PATH = path.join(__dirname, "../data/images-manifest.json");

const [, , artistName, imageUrl] = process.argv;

if (!artistName || !imageUrl) {
  console.error('Usage: node scripts/add-manual-image.js "Artist Name" "https://image-url.jpg"');
  process.exit(1);
}

const manifest = fs.existsSync(MANIFEST_PATH)
  ? JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"))
  : {};

const key = artistName.toLowerCase();
const wasExisting = !!manifest[key];

manifest[key] = imageUrl;
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

console.log(`${wasExisting ? "🔄  Updated" : "✅  Added"}: "${artistName}" → ${imageUrl}`);
console.log(`   Manifest now has ${Object.keys(manifest).length} entries.`);
