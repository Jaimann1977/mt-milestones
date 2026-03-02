/**
 * send-email.js
 * ─────────────
 * Sends the daily milestones email with PDF attached.
 * Mimics the Looker Studio email format but with an MT polish.
 *
 * Environment variables (set in GitHub Actions secrets):
 *   EMAIL_USER        — sender Gmail address (e.g. jason.coyner@musictoday.com)
 *   EMAIL_PASS        — Gmail App Password (NOT your regular password)
 *   EMAIL_TO          — comma-separated recipient list
 *   REPORT_BASE_URL   — public URL of the hosted report (e.g. https://mt-milestones.onrender.com)
 */

const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateFull(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
}

async function main() {
  const { EMAIL_USER, EMAIL_PASS, EMAIL_TO, REPORT_BASE_URL } = process.env;

  if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_TO) {
    console.error("❌  Missing email environment variables. Check EMAIL_USER, EMAIL_PASS, EMAIL_TO.");
    process.exit(1);
  }

  const todayStr = getTodayString();
  const displayDate = formatDateFull(todayStr);
  const pdfPath = path.join(__dirname, `../pdfs/${todayStr}.pdf`);
  const reportUrl = REPORT_BASE_URL || "http://localhost:3000";

  if (!fs.existsSync(pdfPath)) {
    console.error(`❌  PDF not found at ${pdfPath}. Run capture-pdf.js first.`);
    process.exit(1);
  }

  // Read milestone count from report HTML for the email body
  let milestoneCount = "—";
  try {
    const html = fs.readFileSync(path.join(__dirname, "../public/report.html"), "utf8");
    const match = html.match(/<span>(\d+)<\/span> milestone/);
    if (match) milestoneCount = match[1];
  } catch {}

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });

  const emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
    .header { background: #0D0D0F; padding: 24px 32px; display: flex; align-items: center; justify-content: space-between; }
    .logo-area { display: flex; align-items: center; gap: 12px; }
    .logo-mark { width: 32px; height: 32px; background: #CC1E1E; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; color: white; letter-spacing: -0.5px; }
    .logo-text { font-weight: 800; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; color: white; }
    .header-sub { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: #666; text-align: right; }
    .body { padding: 32px; }
    .date-line { font-size: 20px; font-weight: 700; color: #0D0D0F; margin-bottom: 8px; }
    .subtitle { font-size: 13px; color: #666; margin-bottom: 28px; }
    .stat-row { display: flex; gap: 16px; margin-bottom: 28px; }
    .stat { flex: 1; background: #f8f8f8; border-radius: 6px; padding: 16px; text-align: center; border: 1px solid #eee; }
    .stat-num { font-size: 28px; font-weight: 800; color: #CC1E1E; }
    .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #999; margin-top: 4px; }
    .btn { display: block; background: #0D0D0F; color: white; text-decoration: none; text-align: center; padding: 14px 24px; border-radius: 6px; font-weight: 700; font-size: 13px; letter-spacing: 0.05em; margin-bottom: 12px; }
    .btn-secondary { display: block; border: 1px solid #ddd; color: #333; text-decoration: none; text-align: center; padding: 12px 24px; border-radius: 6px; font-size: 13px; margin-bottom: 28px; }
    .footer { font-size: 11px; color: #bbb; text-align: center; border-top: 1px solid #eee; padding: 16px 32px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-area">
        <div class="logo-mark">mt</div>
        <div class="logo-text">musictoday</div>
      </div>
      <div class="header-sub">Daily Report</div>
    </div>
    <div class="body">
      <div class="date-line">${displayDate}</div>
      <div class="subtitle">Your client milestones report is ready. ${milestoneCount} milestone${milestoneCount !== "1" ? "s" : ""} on today's date across Musictoday's client roster.</div>

      <div class="stat-row">
        <div class="stat">
          <div class="stat-num">${milestoneCount}</div>
          <div class="stat-label">Today's Milestones</div>
        </div>
      </div>

      <a href="${reportUrl}" class="btn">View Interactive Report →</a>
      <a href="${reportUrl}/download" class="btn-secondary">Download Today's PDF</a>

      <p style="font-size: 12px; color: #999; line-height: 1.6;">
        The PDF is also attached to this email for your records. The interactive report includes artist biographies and historical context — click any artist image to learn more.
      </p>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} Musictoday · This is an automated daily report · <a href="#" style="color: #bbb;">Unsubscribe</a>
    </div>
  </div>
</body>
</html>`;

  const mailOptions = {
    from: `"Musictoday Milestones" <${EMAIL_USER}>`,
    to: EMAIL_TO,
    subject: `MT Milestones — ${displayDate}`,
    html: emailHtml,
    attachments: [
      {
        filename: `MT-Milestones-${todayStr}.pdf`,
        path: pdfPath,
        contentType: "application/pdf",
      },
    ],
  };

  console.log(`📧  Sending to: ${EMAIL_TO}`);
  const info = await transporter.sendMail(mailOptions);
  console.log(`✅  Email sent: ${info.messageId}`);
}

main().catch((err) => {
  console.error("❌  Email send failed:", err);
  process.exit(1);
});
