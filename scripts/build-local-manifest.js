/**
 * build-local-manifest.js
 * ───────────────────────
 * Scans public/images/ for artist image files and builds data/images-manifest.json
 * by matching filenames to CSV store names.
 *
 * Matching strategy (in order):
 *   1. Exact match: filename stem === store name (case-insensitive)
 *   2. Deezer name match: filename stem === deezer name from name-mapping.json
 *   3. Normalized match: strip punctuation/spaces, compare
 *   4. Partial match: one name starts with or contains the other
 *
 * Usage:
 *   node scripts/build-local-manifest.js
 *
 * After running, commit data/images-manifest.json to Git.
 */

const fs   = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const CSV_PATH      = path.join(__dirname, "../data/milestones.csv");
const MAPPING_PATH  = path.join(__dirname, "../data/name-mapping.json");
const IMAGES_DIR    = path.join(__dirname, "../public/images");
const MANIFEST_PATH = path.join(__dirname, "../data/images-manifest.json");

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

// ─── Normalizer ─────────────────────────────────────────────────────────────
// Strips punctuation, accents, "the ", "& ", extra spaces — used for fuzzy matching
function normalize(str) {
  return str
    .toLowerCase()
    .normalize("NFD")                          // decompose accented chars
    .replace(/[\u0300-\u036f]/g, "")           // strip accent marks
    .replace(/^the\s+/i, "")                   // strip leading "the "
    .replace(/[&+]/g, "and")                   // & → and
    .replace(/[^\w\s]/g, "")                   // strip all punctuation
    .replace(/\s+/g, " ")                      // collapse whitespace
    .trim();
}

// ─── Main ────────────────────────────────────────────────────────────────────
function main() {
  // 1. Check images directory exists
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error(`\n❌  public/images/ directory not found.`);
    console.error(`\n   Please create it and add your artist images:`);
    console.error(`   1. Download the "artist_images" folder from Google Drive`);
    console.error(`   2. Extract the contents into: public/images/`);
    console.error(`   3. Re-run: npm run build-local-manifest\n`);
    process.exit(1);
  }

  // 2. Read all image files
  const imageFiles = fs.readdirSync(IMAGES_DIR).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return IMAGE_EXTENSIONS.has(ext);
  });

  if (imageFiles.length === 0) {
    console.error(`❌  No image files found in public/images/`);
    process.exit(1);
  }

  console.log(`🖼️   Found ${imageFiles.length} image files in public/images/`);

  // 3. Build lookup: normalized stem → filename
  const fileMap = new Map(); // normalized stem → original filename
  for (const f of imageFiles) {
    const stem = path.basename(f, path.extname(f));
    fileMap.set(normalize(stem), f);
    // Also index the raw stem (lowercase) for exact matching
    fileMap.set(stem.toLowerCase().trim(), f);
  }

  // 4. Read CSV store names
  const raw  = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true, bom: true });
  const uniqueStoreNames = [...new Set(rows.map((r) => r["Store Name"].trim()))].sort();
  console.log(`🎵  ${uniqueStoreNames.length} unique artists in CSV`);

  // 5. Load name mapping (MT name → Deezer name)
  const nameMapping = fs.existsSync(MAPPING_PATH)
    ? JSON.parse(fs.readFileSync(MAPPING_PATH, "utf8"))
    : {};

  // 6. Match each store name to an image file
  const manifest = {};
  const matched  = [];
  const unmatched = [];

  for (const storeName of uniqueStoreNames) {
    const storeKey   = storeName.toLowerCase().trim();
    const storeNorm  = normalize(storeName);
    const deezerName = nameMapping[storeName] || null;
    const deezerKey  = deezerName ? deezerName.toLowerCase().trim() : null;
    const deezerNorm = deezerName ? normalize(deezerName) : null;

    let matchedFile = null;
    let matchMethod = null;

    // Strategy 1: exact store name match
    if (!matchedFile && fileMap.has(storeKey)) {
      matchedFile = fileMap.get(storeKey);
      matchMethod = "exact";
    }

    // Strategy 2: exact Deezer name match
    if (!matchedFile && deezerKey && fileMap.has(deezerKey)) {
      matchedFile = fileMap.get(deezerKey);
      matchMethod = "deezer-exact";
    }

    // Strategy 3: normalized store name match
    if (!matchedFile && fileMap.has(storeNorm)) {
      matchedFile = fileMap.get(storeNorm);
      matchMethod = "normalized";
    }

    // Strategy 4: normalized Deezer name match
    if (!matchedFile && deezerNorm && fileMap.has(deezerNorm)) {
      matchedFile = fileMap.get(deezerNorm);
      matchMethod = "deezer-normalized";
    }

    // Strategy 5: partial match — find any file whose stem contains the store name or vice versa
    if (!matchedFile) {
      for (const [key, filename] of fileMap) {
        if (key.includes(storeNorm) || storeNorm.includes(key)) {
          // Only accept if meaningful overlap (avoid single-word false positives on short names)
          if (storeNorm.length > 4 || key === storeNorm) {
            matchedFile = filename;
            matchMethod = "partial";
            break;
          }
        }
      }
    }

    // Strategy 6: partial match on Deezer name
    if (!matchedFile && deezerNorm) {
      for (const [key, filename] of fileMap) {
        if (key.includes(deezerNorm) || deezerNorm.includes(key)) {
          if (deezerNorm.length > 4 || key === deezerNorm) {
            matchedFile = filename;
            matchMethod = "deezer-partial";
            break;
          }
        }
      }
    }

    if (matchedFile) {
      manifest[storeKey] = `images/${matchedFile}`;
      matched.push({ storeName, matchedFile, matchMethod });
    } else {
      unmatched.push(storeName);
    }
  }

  // 7. Save manifest
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  // 8. Report
  console.log(`\n${"─".repeat(60)}`);
  console.log(`✅  Matched:   ${matched.length} artists`);
  console.log(`❌  Unmatched: ${unmatched.length} artists`);
  console.log(`\n   Manifest saved to: data/images-manifest.json`);

  // Show match method breakdown
  const methods = {};
  for (const { matchMethod } of matched) {
    methods[matchMethod] = (methods[matchMethod] || 0) + 1;
  }
  console.log(`\n   Match methods:`);
  for (const [method, count] of Object.entries(methods).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${method.padEnd(20)} ${count}`);
  }

  if (unmatched.length > 0) {
    console.log(`\n   Unmatched artists (${unmatched.length}):`);
    unmatched.forEach((name) => console.log(`     • ${name}`));
    console.log(`\n   For each, either:`);
    console.log(`     a) Rename the image file in public/images/ to match the artist name, then re-run`);
    console.log(`     b) Manually add it: npm run add-image "Artist Name" "images/filename.jpg"`);
  }

  // Optionally log all matches at verbose level
  if (process.argv.includes("--verbose")) {
    console.log(`\n   All matches:`);
    for (const { storeName, matchedFile, matchMethod } of matched) {
      console.log(`     [${matchMethod.padEnd(18)}] ${storeName.padEnd(40)} → ${matchedFile}`);
    }
  }
}

main();
