/* ============================================================
   Soai — live stat sheet, backed by a Google Sheet (or any CSV URL).
   The admin pastes a sheet link once (admin panel → Preseason →
   Live stat sheet); the stats page then fetches the sheet as CSV on
   every visit and re-fetches while open, so any stat logged in the
   sheet shows up on the site automatically — no re-deploy needed.

   Works with:
   - a normal Google Sheets link (docs.google.com/spreadsheets/d/<id>/…)
     shared as "Anyone with the link → Viewer" — converted to the
     sheet's CSV endpoint automatically (keeps the #gid tab if present)
   - a "Publish to web → CSV" link (…/pub?output=csv)
   - any direct .csv URL (e.g. an exported Excel sheet hosted anywhere)
   ============================================================ */

/* Turn whatever sheet link the admin pasted into a fetchable CSV URL. */
function sheetCsvUrl(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  // published-to-web links: /d/e/<pubid>/pubhtml or /pub → force CSV output
  let m = u.match(/docs\.google\.com\/spreadsheets\/d\/e\/([\w-]+)/);
  if (m) {
    const gid = (u.match(/[#?&]gid=(\d+)/) || [])[1];
    return "https://docs.google.com/spreadsheets/d/e/" + m[1] + "/pub?output=csv" + (gid ? "&gid=" + gid : "");
  }
  // normal sheet links: /d/<id>/edit#gid=N → gviz CSV endpoint (works with link-sharing)
  m = u.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/);
  if (m) {
    const gid = (u.match(/[#?&]gid=(\d+)/) || [])[1] || "0";
    return "https://docs.google.com/spreadsheets/d/" + m[1] + "/gviz/tq?tqx=out:csv&gid=" + gid;
  }
  return u;   // anything else: assume it already serves CSV
}

/* Quote-aware CSV parser → array of rows (arrays of strings). */
function parseCsv(text) {
  const rows = []; let row = [], cell = "", inQ = false;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

/* Fetch + parse the sheet. Returns { headers, rows } or throws. */
async function fetchSheet(url) {
  const csv = sheetCsvUrl(url);
  if (!csv) throw new Error("no sheet connected");
  const res = await fetch(csv, { cache: "no-store", redirect: "follow" });
  if (!res.ok) throw new Error("sheet returned HTTP " + res.status);
  const text = await res.text();
  if (/<html[\s>]/i.test(text.slice(0, 300))) throw new Error("that link returns a web page, not CSV — check the sheet is shared “Anyone with the link” or published as CSV");
  const all = parseCsv(text).filter(r => r.some(c => c.trim() !== ""));
  if (!all.length) throw new Error("the sheet is empty");
  return { headers: all[0], rows: all.slice(1) };
}

function sheetEsc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* Render {headers, rows} as a standings-style table into `host`. */
function renderSheetTable(host, data) {
  const isNum = v => v.trim() !== "" && !isNaN(v.replace(/[%+]/g, ""));
  // a column is numeric if every non-empty cell in it parses as a number
  const numCol = data.headers.map((_, i) =>
    data.rows.length > 0 && data.rows.every(r => (r[i] == null || r[i].trim() === "") || isNum(r[i])));
  host.innerHTML = `
    <div class="table-scroll">
      <table class="standings">
        <thead><tr>${data.headers.map((h, i) => `<th${numCol[i] ? ' class="num"' : ""}>${sheetEsc(h)}</th>`).join("")}</tr></thead>
        <tbody>${data.rows.map(r => `<tr>${data.headers.map((_, i) =>
          `<td${numCol[i] ? ' class="num"' : ""}>${sheetEsc(r[i] == null ? "" : r[i])}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>`;
}

/* Per-category leaders from the sheet: for every numeric column, the top 3
   rows by value. The first non-numeric column is treated as the player name,
   the second (if any) as their team. */
function renderSheetLeaders(host, data) {
  if (!host) return;
  const val = c => parseFloat(String(c == null ? "" : c).replace(/[%+,]/g, ""));
  const numeric = i => data.rows.some(r => !isNaN(val(r[i]))) &&
    data.rows.every(r => (r[i] == null || String(r[i]).trim() === "") || !isNaN(val(r[i])));
  const textCols = data.headers.map((_, i) => i).filter(i => !numeric(i));
  const nameCol = textCols[0] != null ? textCols[0] : 0;
  const teamCol = textCols[1];
  const medal = ["🥇", "🥈", "🥉"];
  const cards = data.headers.map((h, i) => {
    if (!numeric(i) || i === nameCol) return "";
    const top = data.rows
      .filter(r => !isNaN(val(r[i])))
      .slice().sort((a, b) => val(b[i]) - val(a[i]))
      .slice(0, 3);
    if (!top.length) return "";
    return `
      <div class="lp-tile">
        <span class="lp-ic">🏅</span>
        <h3>${sheetEsc(h)}</h3>
        <p>${top.map((r, k) => `${medal[k]} <b>${sheetEsc(r[nameCol])}</b>${teamCol != null && r[teamCol] ? ` <span style="color:var(--muted)">(${sheetEsc(r[teamCol])})</span>` : ""} — ${sheetEsc(r[i])}`).join("<br>")}</p>
      </div>`;
  }).filter(Boolean);
  host.innerHTML = cards.length ? cards.join("") : "";
  const sec = host.closest("section");
  if (sec) sec.style.display = cards.length ? "" : "none";
}

/* ---- official player leaderboard ----
   Weighted points over the sheet's stat columns (matched by header name):
   Kills ×2 · Aces ×2 · Blocks ×2 · Digs ×1 · Assists ×1 · MVPs ×10.
   Columns not in the table below don't score (e.g. Games, Position). */
const LB_WEIGHTS = { kill: 2, ace: 2, block: 2, dig: 1, assist: 1, mvp: 10 };

function computeSheetBoard(data) {
  const val = c => parseFloat(String(c == null ? "" : c).replace(/[%+,]/g, ""));
  const weightFor = h => {
    const k = String(h || "").toLowerCase();
    for (const w in LB_WEIGHTS) if (k.indexOf(w) !== -1) return LB_WEIGHTS[w];
    return 0;
  };
  const weights = data.headers.map(weightFor);
  const numeric = i => data.rows.some(r => !isNaN(val(r[i])));
  const textCols = data.headers.map((_, i) => i).filter(i => !numeric(i) || i === 0);
  const nameCol = 0, teamCol = textCols[1];
  return data.rows.map(r => {
    let pts = 0;
    weights.forEach((w, i) => { if (w) { const v = val(r[i]); if (!isNaN(v)) pts += w * v; } });
    return { name: r[nameCol] || "", team: teamCol != null ? (r[teamCol] || "") : "", pts: Math.round(pts * 10) / 10 };
  }).filter(p => p.name && p.pts > 0).sort((a, b) => b.pts - a.pts);
}

function renderSheetBoard(host, data) {
  if (!host) return;
  const rows = computeSheetBoard(data).slice(0, 10);
  const sec = host.closest("section");
  if (!rows.length) { if (sec) sec.style.display = "none"; return; }
  if (sec) sec.style.display = "";
  const medal = ["🥇", "🥈", "🥉"];
  host.innerHTML = `
    <div class="table-scroll">
      <table class="standings">
        <thead><tr><th>Rank</th><th>Player</th><th>Team</th><th class="num">Points</th></tr></thead>
        <tbody>${rows.map((p, i) => `
          <tr>
            <td class="rk">${medal[i] || i + 1}</td>
            <td><b>${sheetEsc(p.name)}</b></td>
            <td>${sheetEsc(p.team)}</td>
            <td class="num"><b>${p.pts}</b></td>
          </tr>`).join("")}</tbody>
      </table>
    </div>
    <p class="mini-note" style="margin-top:10px;color:var(--muted);font-size:12.5px">
      Formula: Kills ×2 · Aces ×2 · Blocks ×2 · Digs ×1 · Assists ×1 · MVPs ×10 — computed live from the logged stat sheet.
    </p>`;
}

/* ---- homepage MVP race widget (#mvpRace) ---- */
async function initMvpRace() {
  const host = document.getElementById("mvpRace");
  if (!host) return;
  let site = {};
  try { site = await apiGet("/site"); } catch (e) { /* leave empty */ }
  if (!site || !site.statSheet) { host.style.display = "none"; return; }
  let data;
  try { data = await fetchSheet(site.statSheet); } catch (e) { host.style.display = "none"; return; }
  const rows = computeSheetBoard(data).slice(0, 3);
  if (!rows.length) { host.style.display = "none"; return; }
  const medal = ["🥇", "🥈", "🥉"];
  host.innerHTML = `
    <div class="psl-head">
      <span class="psl-eyebrow">⭐ MVP Race · Official Player Leaderboard</span>
      <span class="psl-date">Live from the stat sheet</span>
    </div>
    <div class="psl-top3">
      ${rows.map((p, i) => `<div class="psl-item"><span class="psl-rank">${i + 1}</span><span class="psl-medal">${medal[i]}</span><span class="psl-name">${sheetEsc(p.name)}${p.team ? ` <span style="color:var(--muted);font-weight:600">· ${sheetEsc(p.team)}</span>` : ""}</span><span class="psl-pts">${p.pts} pts</span></div>`).join("")}
    </div>
    <a class="psl-link" href="stats.html">Full stats &amp; leaderboard →</a>`;
}

/* ---- public stat-sheet section (#sheetHost on the stats page) ----
   Fetches on load and re-fetches every 60s while the page is open. */
async function initStatSheet() {
  const host = document.getElementById("sheetHost");
  if (!host) return;
  const status = document.getElementById("sheetStatus");
  let site = {};
  try { site = await apiGet("/site"); } catch (e) { /* leave empty */ }
  const url = site && site.statSheet;
  const leaders = document.getElementById("sheetLeaders");
  if (!url) {
    if (leaders && leaders.closest("section")) leaders.closest("section").style.display = "none";
    const board = document.getElementById("sheetBoard");
    if (board && board.closest("section")) board.closest("section").style.display = "none";
    host.innerHTML = `
      <div class="card" style="text-align:center;padding:26px">
        <div style="font-size:30px">📋</div>
        <b>No stat sheet connected yet</b>
        <p class="mini-note" style="margin:6px auto 0;max-width:600px">Admins — three steps:
          <b>1.</b> download the official stat sheet template below ·
          <b>2.</b> import it into Google Sheets (File → Import) and set Share to “Anyone with the link → Viewer” ·
          <b>3.</b> paste the sheet's link in the <a href="admin.html">admin panel</a> → Preseason → <b>Live stat sheet</b>.
          Every stat logged in the sheet then shows here automatically — full instructions are on the template's Instructions tab.</p>
        <p style="margin:14px 0 0"><a class="btn" href="files/binsu-stat-sheet.xlsx" download>⬇️ Download the stat sheet template (Excel)</a></p>
      </div>`;
    return;
  }
  const load = async () => {
    try {
      const data = await fetchSheet(url);
      renderSheetTable(host, data);
      renderSheetLeaders(leaders, data);
      renderSheetBoard(document.getElementById("sheetBoard"), data);
      if (status) status.textContent = "Auto-updates from the connected sheet · refreshed " + new Date().toLocaleTimeString();
    } catch (e) {
      if (!host.querySelector("table")) host.innerHTML = `<p class="empty">⚠️ Couldn't load the stat sheet — ${sheetEsc(e.message)}.</p>`;
      if (status) status.textContent = "Last refresh failed · " + new Date().toLocaleTimeString();
    }
  };
  await load();
  setInterval(load, 60000);
  const btn = document.getElementById("sheetRefresh");
  if (btn) btn.addEventListener("click", load);
}

document.addEventListener("DOMContentLoaded", function () { initStatSheet(); initMvpRace(); });
