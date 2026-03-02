/**
 * enrich-notes.js
 * ───────────────
 * One-time script to populate the "Notes" column in milestones.csv
 * using the Anthropic API. Processes rows in batches, saves progress
 * after every batch so it's safe to stop and resume at any time.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node scripts/enrich-notes.js
 *
 * Progress is tracked in data/enrich-progress.json so you can
 * ctrl-C and re-run and it will pick up where it left off.
 */

const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");

// ─── Config ────────────────────────────────────────────────────────────────
const CSV_PATH = path.join(__dirname, "../data/milestones.csv");
const PROGRESS_PATH = path.join(__dirname, "../data/enrich-progress.json");
const BATCH_SIZE = 20;       // rows per API call — sweet spot for quality + speed
const DELAY_MS = 1000;       // ms between batches to respect rate limits
// ───────────────────────────────────────────────────────────────────────────

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function loadProgress() {
  if (fs.existsSync(PROGRESS_PATH)) {
    return JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf8"));
  }
  return { lastCompletedIndex: -1 };
}

function saveProgress(index) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify({ lastCompletedIndex: index }));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Builds the prompt for a batch of rows.
 * Returns a JSON array of {index, notes} objects.
 */
function buildPrompt(batch) {
  const items = batch
    .map(
      ({ i, row }) =>
        `${i}. Artist: "${row["Store Name"]}" | Event: "${row["Event"]}" | Date: ${row["Event Date"]} | Type: ${row["Event Type"]}`
    )
    .join("\n");

  return `You are writing historical liner-note blurbs for a music industry milestone report used internally at Musictoday, a music merchandise and marketing agency.

For each event below, write a 2-4 sentence Notes blurb. Rules:
- Be factual and historically accurate
- Write in present tense ("is", "marks", "celebrates") when describing the anniversary context, past tense for historical facts
- For birthdays: mention the artist's real name if different, one or two career highlights, and what makes them significant
- For album/single releases: mention chart performance, cultural impact, standout tracks, and any interesting recording context
- For deaths: be respectful, mention cause only if widely known and not graphic, focus on legacy
- For general events: provide historical context and significance
- Keep it conversational — this will appear as a pop-up on an interactive report
- Do NOT start with the artist's name (it's already shown in the UI)
- Do NOT use markdown, bold, or special formatting
- Return ONLY a valid JSON array. No preamble, no backticks. Format:
[{"index": <number>, "notes": "<blurb text>"}]

Events:
${items}`;
}

async function enrichBatch(batch) {
  const prompt = buildPrompt(batch);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].text.trim();

  // Strip any accidental markdown fences
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();

  let results;
  try {
    results = JSON.parse(cleaned);
  } catch (e) {
    console.error("⚠️  JSON parse failed for batch. Raw response:\n", text);
    // Return empty notes rather than crashing
    return batch.map(({ i }) => ({ index: i, notes: "" }));
  }

  return results;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌  ANTHROPIC_API_KEY environment variable not set.");
    process.exit(1);
  }

  console.log("📖  Reading CSV...");
  const raw = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true, bom: true });
  console.log(`   ${rows.length} rows found.`);

  const progress = loadProgress();
  const startIndex = progress.lastCompletedIndex + 1;
  console.log(`▶️   Starting from row ${startIndex} (${rows.length - startIndex} remaining)`);

  // Work through rows in batches
  for (let i = startIndex; i < rows.length; i += BATCH_SIZE) {
    const batchRows = rows.slice(i, i + BATCH_SIZE);
    const batch = batchRows.map((row, offset) => ({ i: i + offset, row }));

    // Skip rows that already have notes filled in
    const toEnrich = batch.filter(({ row }) => !row["Notes"] || row["Notes"].trim() === "");
    const alreadyDone = batch.filter(({ row }) => row["Notes"] && row["Notes"].trim() !== "");

    if (alreadyDone.length > 0) {
      console.log(`   ⏭️  Skipping ${alreadyDone.length} already-enriched rows in this batch`);
    }

    if (toEnrich.length > 0) {
      const batchEnd = Math.min(i + BATCH_SIZE - 1, rows.length - 1);
      process.stdout.write(
        `🎵  Rows ${i}–${batchEnd} (${Math.round((i / rows.length) * 100)}%)... `
      );

      try {
        const results = await enrichBatch(toEnrich);

        // Write results back into the rows array
        for (const { index, notes } of results) {
          if (rows[index] !== undefined) {
            rows[index]["Notes"] = notes;
          }
        }

        console.log("✅");
      } catch (err) {
        console.error(`\n❌  Error on batch starting at ${i}:`, err.message);
        console.log("   Saving progress and pausing 5s before continuing...");
        await sleep(5000);
      }
    }

    // Save after every batch so we can resume if interrupted
    saveProgress(i + BATCH_SIZE - 1);

    // Write the CSV back to disk with updated notes
    const output = stringify(rows, { header: true });
    fs.writeFileSync(CSV_PATH, output);

    if (i + BATCH_SIZE < rows.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log("\n✨  Enrichment complete! All notes have been written to data/milestones.csv");
  console.log("   You can safely delete data/enrich-progress.json now.");
}

main().catch(console.error);
