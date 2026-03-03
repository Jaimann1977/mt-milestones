/**
 * generate-report.js
 */

const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const CSV_PATH = path.join(__dirname, "../data/milestones.csv");
const OUTPUT_PATH = path.join(__dirname, "../public/report.html");

function getTodayString() {
  const arg = process.argv[2];
  if (arg) return arg;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseMilestoneDate(dateStr) {
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  return { month: parseInt(parts[0], 10), day: parseInt(parts[1], 10), year: parseInt(parts[2], 10) };
}

function formatDisplayDate(dateStr) {
  const d = parseMilestoneDate(dateStr);
  if (!d) return dateStr;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.month - 1]} ${d.day}, ${d.year}`;
}

function formatTodayFull(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

let _manifest = null;
function getArtistImageUrl(artistName) {
  if (!_manifest) {
    const manifestPath = path.join(__dirname, "../data/images-manifest.json");
    _manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
  }
  const raw = _manifest[artistName.toLowerCase().trim()];
  if (!raw) return null;
  const parts = raw.split("/");
  parts[parts.length - 1] = encodeURIComponent(parts[parts.length - 1]);
  return parts.join("/");
}

function getEventMeta(eventType) {
  const map = {
    "Album Release": { label: "ALBUM", color: "#E8B86D" },
    "EP Release":    { label: "EP",    color: "#E8B86D" },
    "Birthday":      { label: "BDAY",  color: "#7EC8A4" },
    "Death":         { label: "RIP",   color: "#C47A7A" },
    "Event":         { label: "EVENT", color: "#85A8D0" },
  };
  return map[eventType] || { label: eventType.toUpperCase().slice(0, 5), color: "#888" };
}

function main() {
  const todayStr = getTodayString();
  const [, todayMonth, todayDay] = todayStr.split("-").map(Number);
  console.log(`📅  Generating report for ${todayStr}...`);

  const raw = fs.readFileSync(CSV_PATH, "utf8");
  const allRows = parse(raw, { columns: true, skip_empty_lines: true, bom: true });

  const milestones = allRows.filter((row) => {
    const d = parseMilestoneDate(row["Event Date"]);
    if (!d) return false;
    return d.month === todayMonth && d.day === todayDay;
  });

  milestones.sort((a, b) => Number(b["Anniversary Year"]) - Number(a["Anniversary Year"]));
  console.log(`   Found ${milestones.length} milestones for today.`);

  const uniqueArtists = [...new Map(milestones.map((r) => [r["Store Name"], r])).values()];
  const html = buildHTML(milestones, uniqueArtists, todayStr);
  fs.writeFileSync(OUTPUT_PATH, html);
  console.log(`✅  Written to ${OUTPUT_PATH}`);
}

function buildHTML(milestones, uniqueArtists, todayStr) {
  const displayDate = formatTodayFull(todayStr);
  const tableRows   = milestones.map(buildTableRow).join("\n");
  const artistCards = uniqueArtists.map(buildArtistCard).join("\n");
  const manyRows    = milestones.length > 12;

  const contentStyle = manyRows
    ? "display:grid; grid-template-columns:1fr 260px; align-items:start;"
    : "display:flex; flex-direction:column;";

  const artistsStyle = manyRows
    ? "padding-left:24px; border-left:1px solid var(--border);"
    : "margin-top:28px;";

  const artistGridStyle = manyRows ? "flex-direction:column;" : "";
  const cardStyle = manyRows ? "flex-direction:row; width:100%; gap:10px;" : "flex-direction:column; width:80px; gap:0;";
  const imgSize = manyRows ? "40px" : "60px";
  const nameStyle = manyRows
    ? "font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"
    : "font-size:10px; text-align:center; margin-top:6px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;";
  const placeholderFontSize = manyRows ? "14px" : "18px";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MT Milestones — ${displayDate}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{
      --bg:#0D0D0F;--surface:#16161A;--surface2:#1E1E24;--border:#2A2A32;
      --text:#E8E8EE;--text-muted:#7A7A8C;--text-dim:#4A4A58;
      --accent:#CC1E1E;--gold:#E8B86D;--green:#7EC8A4;--blue:#85A8D0;--red-soft:#C47A7A;
      --radius:6px;--font-head:'Montserrat',sans-serif;--font-body:'Montserrat',sans-serif;--font-mono:'DM Mono',monospace;
    }
    html,body{min-height:100vh;background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:13px;-webkit-font-smoothing:antialiased;}
    body::before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");background-size:200px 200px;pointer-events:none;z-index:0;opacity:0.5;}
    .page{position:relative;z-index:1;max-width:1280px;min-width:800px;width:100%;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;}
    .header{display:flex;align-items:center;justify-content:space-between;padding:20px 36px 18px;border-bottom:1px solid var(--border);background:linear-gradient(to bottom,rgba(204,30,30,0.06) 0%,transparent 100%);position:relative;}
    .header::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(to right,transparent,var(--accent),transparent);opacity:0.6;}
    .header-left{display:flex;align-items:center;gap:16px;}
    .logo{height:36px;width:auto;}
    .logo-fallback{height:36px;display:flex;align-items:center;gap:8px;}
    .logo-mark{width:36px;height:36px;background:var(--accent);border-radius:4px;display:flex;align-items:center;justify-content:center;font-family:var(--font-head);font-weight:800;font-size:16px;color:white;letter-spacing:-1px;}
    .logo-text{font-family:var(--font-head);font-weight:800;font-size:15px;letter-spacing:0.08em;text-transform:uppercase;color:var(--text);}
    .divider-v{width:1px;height:28px;background:var(--border);}
    .header-title{font-family:var(--font-head);font-weight:800;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:var(--text-muted);}
    .header-right{text-align:right;}
    .header-date{font-family:var(--font-head);font-weight:800;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:var(--text);}
    .header-count{font-family:var(--font-mono);font-size:11px;color:var(--text-muted);margin-top:3px;}
    .header-count span{color:var(--accent);font-weight:500;}
    .content{flex:1;padding:28px 36px;${contentStyle}}
    .table-section{min-width:0;}
    .section-label{font-family:var(--font-head);font-weight:800;font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:var(--text-dim);margin-bottom:12px;}
    .milestone-table{width:100%;border-collapse:collapse;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;}
    .milestone-table thead th{background:var(--surface2);font-family:var(--font-head);font-weight:800;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:var(--text-muted);padding:10px 14px;text-align:left;border-bottom:1px solid var(--border);}
    .milestone-table thead th:last-child{text-align:center;}
    .milestone-table tbody tr{border-bottom:1px solid var(--border);transition:background 0.15s;}
    .milestone-table tbody tr:last-child{border-bottom:none;}
    .milestone-table tbody tr:hover{background:var(--surface2);}
    .milestone-table td{padding:10px 14px;vertical-align:middle;}
    .td-artist{font-family:var(--font-head);font-weight:700;font-size:13px;color:var(--text);white-space:nowrap;}
    .td-event{font-size:13px;color:var(--text);max-width:340px;}
    .td-date{font-family:var(--font-mono);font-size:11px;color:var(--text-muted);white-space:nowrap;}
    .td-type{padding:8px 14px;}
    .badge{display:inline-block;font-family:var(--font-head);font-weight:800;font-size:8px;letter-spacing:0.15em;padding:3px 7px;border-radius:3px;background:rgba(255,255,255,0.06);border:1px solid currentColor;opacity:0.85;}
    .td-anniversary{text-align:center;font-family:var(--font-mono);font-size:12px;}
    .anniversary-chip{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:500;}
    .anniversary-chip.significant{background:rgba(232,184,109,0.15);color:var(--gold);border:1px solid rgba(232,184,109,0.3);}
    .anniversary-chip.normal{color:var(--text-muted);}
    .artists-section{${artistsStyle}}
    .artist-grid{display:flex;flex-wrap:wrap;gap:8px;${artistGridStyle}}
    .artist-card{cursor:pointer;display:flex;align-items:center;${cardStyle}padding:8px;border-radius:var(--radius);border:1px solid transparent;transition:all 0.2s;}
    .artist-card:hover{background:var(--surface2);border-color:var(--border);}
    .artist-img-wrap{position:relative;flex-shrink:0;width:${imgSize};height:${imgSize};border-radius:50%;overflow:hidden;background:var(--surface2);border:2px solid var(--border);transition:border-color 0.2s;}
    .artist-card:hover .artist-img-wrap{border-color:var(--accent);}
    .artist-img{width:100%;height:100%;object-fit:cover;display:block;}
    .artist-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:var(--font-head);font-weight:800;font-size:${placeholderFontSize};color:var(--text-muted);background:linear-gradient(135deg,var(--surface2),var(--surface));}
    .artist-name{font-family:var(--font-head);font-weight:700;color:var(--text);line-height:1.3;${nameStyle}}
    .empty-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:80px;color:var(--text-dim);}
    .empty-icon{font-size:48px;opacity:0.3;}
    .empty-text{font-family:var(--font-head);font-weight:800;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;}
    .footer{border-top:1px solid var(--border);padding:12px 36px;display:flex;align-items:center;justify-content:space-between;}
    .footer-left{font-family:var(--font-mono);font-size:10px;color:var(--text-dim);}
    .download-btn{font-family:var(--font-head);font-weight:800;font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text-muted);text-decoration:none;padding:6px 14px;border:1px solid var(--border);border-radius:var(--radius);transition:all 0.15s;}
    .download-btn:hover{border-color:var(--accent);color:var(--accent);}
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:1000;opacity:0;pointer-events:none;transition:opacity 0.25s;}
    .modal-overlay.open{opacity:1;pointer-events:all;}
    .modal{background:var(--surface);border:1px solid var(--border);border-radius:12px;width:480px;max-width:90vw;overflow:hidden;transform:translateY(20px) scale(0.97);transition:transform 0.25s cubic-bezier(0.34,1.56,0.64,1);box-shadow:0 32px 80px rgba(0,0,0,0.6);}
    .modal-overlay.open .modal{transform:translateY(0) scale(1);}
    .modal-img-wrap{width:100%;height:220px;overflow:hidden;background:var(--surface2);position:relative;}
    .modal-img{width:100%;height:100%;object-fit:cover;object-position:center top;display:block;}
    .modal-img-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:var(--font-head);font-weight:800;font-size:64px;color:var(--text-dim);background:linear-gradient(135deg,var(--surface2),var(--bg));}
    .modal-img-overlay{position:absolute;bottom:0;left:0;right:0;height:80px;background:linear-gradient(to top,var(--surface),transparent);}
    .modal-body{padding:24px 28px 28px;}
    .modal-artist{font-family:var(--font-head);font-weight:800;font-size:20px;color:var(--text);text-transform:uppercase;}
    .modal-event{font-size:12px;color:var(--text-muted);margin-top:4px;}
    .modal-notes{margin-top:16px;font-size:13px;line-height:1.7;color:var(--text);border-top:1px solid var(--border);padding-top:16px;}
    .modal-no-notes{font-style:italic;color:var(--text-muted);}
    .modal-milestones{margin-top:14px;display:flex;flex-direction:column;gap:4px;}
    .modal-milestone-row{font-size:11px;color:var(--text-muted);display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);}
    .modal-milestone-row:last-child{border-bottom:none;}
    .modal-close{position:absolute;top:12px;right:12px;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1);color:white;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.15s;z-index:10;}
    .modal-close:hover{background:var(--accent);}
    @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    .milestone-table tbody tr{animation:fadeUp 0.3s ease both;}
    ${Array.from({length:30},(_,i)=>`.milestone-table tbody tr:nth-child(${i+1}){animation-delay:${i*25}ms}`).join(";")}
    .artist-card{animation:fadeUp 0.3s ease both;}
    ${Array.from({length:20},(_,i)=>`.artist-card:nth-child(${i+1}){animation-delay:${150+i*40}ms}`).join(";")}
  </style>
</head>
<body>
<div class="page">

  <header class="header">
    <div class="header-left">
      <img src="/mtlogo_long.png" alt="Musictoday" class="logo"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="logo-fallback" style="display:none">
        <div class="logo-mark">mt</div>
        <div class="logo-text">musictoday</div>
      </div>
      <div class="divider-v"></div>
      <div class="header-title">Today's Milestones</div>
    </div>
    <div class="header-right">
      <div class="header-date">${displayDate}</div>
      <div class="header-count"><span>${milestones.length}</span> milestone${milestones.length !== 1 ? "s" : ""} today</div>
    </div>
  </header>

  <main class="content">
    ${milestones.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">🎵</div>
        <div class="empty-text">No milestones today</div>
      </div>` : `
    <div class="table-section">
      <div class="section-label">Client Milestones</div>
      <table class="milestone-table">
        <thead>
          <tr>
            <th>Artist / Client</th>
            <th>Event</th>
            <th>Original Date</th>
            <th>Type</th>
            <th>Anniversary</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    <div class="artists-section">
      <div class="section-label">${manyRows ? "Artists" : "Featured Artists"} — click for details</div>
      <div class="artist-grid">${artistCards}</div>
    </div>`}
  </main>

  <footer class="footer">
    <div class="footer-left">Generated ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET · Musictoday Internal</div>
    <a href="/download" class="download-btn">↓ Download PDF</a>
  </footer>

</div>

<div class="modal-overlay" id="modalOverlay" onclick="closeModal(event)">
  <div class="modal" id="modalContent"></div>
</div>

<script>
  const artistData = ${JSON.stringify(
    uniqueArtists.reduce((acc, row) => {
      acc[row["Store Name"]] = {
        name:       row["Store Name"],
        notes:      row["Notes"] || "",
        imageUrl:   getArtistImageUrl(row["Store Name"]),
        milestones: milestones
          .filter((r) => r["Store Name"] === row["Store Name"])
          .map((r) => ({
            event: r["Event"], date: r["Event Date"],
            anniversary: r["Anniversary Year"], significant: r["Five or Ten"] === "Y",
          })),
      };
      return acc;
    }, {}),
    null, 2
  )};

  function openModal(artistName) {
    const data = artistData[artistName];
    if (!data) return;
    const overlay = document.getElementById("modalOverlay");
    const content = document.getElementById("modalContent");

    const imgHtml = data.imageUrl
      ? \`<div class="modal-img-wrap">
           <img class="modal-img" src="\${data.imageUrl}" alt="\${data.name}"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
           <div class="modal-img-placeholder" style="display:none">\${data.name.charAt(0)}</div>
           <div class="modal-img-overlay"></div>
           <button class="modal-close" onclick="document.getElementById('modalOverlay').classList.remove('open')">✕</button>
         </div>\`
      : \`<div class="modal-img-wrap">
           <div class="modal-img-placeholder">\${data.name.charAt(0)}</div>
           <div class="modal-img-overlay"></div>
           <button class="modal-close" onclick="document.getElementById('modalOverlay').classList.remove('open')">✕</button>
         </div>\`;

    const milestoneRows = data.milestones.map(m =>
      \`<div class="modal-milestone-row">
         <span>\${m.event}</span>
         <span style="color:\${m.significant?'var(--gold)':'var(--text-muted)'};font-weight:500">\${m.anniversary}-Year</span>
       </div>\`
    ).join("");

    content.innerHTML = \`\${imgHtml}
      <div class="modal-body">
        <div class="modal-artist">\${data.name}</div>
        <div class="modal-event">\${data.milestones.length} milestone\${data.milestones.length!==1?"s":""} today</div>
        <div class="modal-notes">\${data.notes||'<span class="modal-no-notes">Historical notes coming soon.</span>'}</div>
        \${data.milestones.length>1?\`<div class="modal-milestones">\${milestoneRows}</div>\`:""}
      </div>\`;

    overlay.classList.add("open");
  }

  function closeModal(e) {
    if (e && e.target !== document.getElementById("modalOverlay")) return;
    document.getElementById("modalOverlay").classList.remove("open");
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.getElementById("modalOverlay").classList.remove("open");
  });
</script>
</body>
</html>`;
}

function buildTableRow(row) {
  const { label, color } = getEventMeta(row["Event Type"]);
  const anni  = Number(row["Anniversary Year"]);
  const isSig = row["Five or Ten"] === "Y";
  return `<tr>
  <td class="td-artist">${escapeHtml(row["Store Name"])}</td>
  <td class="td-event">${escapeHtml(row["Event"])}</td>
  <td class="td-date">${formatDisplayDate(row["Event Date"])}</td>
  <td class="td-type"><span class="badge" style="color:${color};border-color:${color}40">${label}</span></td>
  <td class="td-anniversary"><span class="anniversary-chip ${isSig?"significant":"normal"}">${anni} yr${anni!==1?"s":""}</span></td>
</tr>`;
}

function buildArtistCard(row) {
  const imageUrl = getArtistImageUrl(row["Store Name"]);
  const initial  = row["Store Name"].charAt(0).toUpperCase();
  const safeName = escapeHtml(row["Store Name"]);
  const jsName   = row["Store Name"].replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  const imgHtml = imageUrl
    ? `<div class="artist-img-wrap"><img class="artist-img" src="${imageUrl}" alt="${safeName}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="artist-placeholder" style="display:none">${initial}</div></div>`
    : `<div class="artist-img-wrap"><div class="artist-placeholder">${initial}</div></div>`;

  return `<div class="artist-card" onclick="openModal('${jsName}')">${imgHtml}<div class="artist-name">${safeName}</div></div>`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

main();
