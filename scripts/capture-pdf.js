/**
 * capture-pdf.js
 * ──────────────
 * Uses Puppeteer to capture a pixel-perfect PDF of today's report.
 * Deletes yesterday's PDF. Saves today's as YYYY-MM-DD.pdf.
 *
 * Usage:
 *   node scripts/capture-pdf.js
 */

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const PDF_DIR = path.join(__dirname, "../pdfs");
const REPORT_PATH = path.join(__dirname, "../public/report.html");

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getYesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function main() {
  if (!fs.existsSync(PDF_DIR)) {
    fs.mkdirSync(PDF_DIR, { recursive: true });
  }

  // Delete yesterday's PDF
  const yesterdayPdf = path.join(PDF_DIR, `${getYesterdayString()}.pdf`);
  if (fs.existsSync(yesterdayPdf)) {
    fs.unlinkSync(yesterdayPdf);
    console.log(`🗑️   Deleted: ${getYesterdayString()}.pdf`);
  }

  const todayStr = getTodayString();
  const outputPath = path.join(PDF_DIR, `${todayStr}.pdf`);

  console.log("🌐  Launching Puppeteer...");

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
    ],
  });

  const page = await browser.newPage();

  // Load the report HTML directly from file (no server needed for PDF gen)
  const reportUrl = `file://${REPORT_PATH}`;
  await page.goto(reportUrl, { waitUntil: "networkidle0", timeout: 30000 });

  // Wait for fonts and animations to settle
  await new Promise(r => setTimeout(r, 1500));

  // Set viewport to match the fixed 1280px design
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });

  // Get the full page height
  const bodyHeight = await page.evaluate(() => document.body.scrollHeight);

  await page.pdf({
    path: outputPath,
    width: "1280px",
    height: `${bodyHeight}px`,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  await browser.close();

  console.log(`✅  PDF saved: pdfs/${todayStr}.pdf`);

  // Write a pointer file so the server knows which PDF is current
  fs.writeFileSync(
    path.join(__dirname, "../data/current-pdf.json"),
    JSON.stringify({ date: todayStr, path: `pdfs/${todayStr}.pdf` })
  );
}

main().catch((err) => {
  console.error("❌  PDF capture failed:", err);
  process.exit(1);
});
