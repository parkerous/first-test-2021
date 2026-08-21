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

/* ---- public stat-sheet section (#sheetHost on the stats page) ----
   Fetches on load and re-fetches every 60s while the page is open. */
async function initStatSheet() {
  const host = document.getElementById("sheetHost");
  if (!host) return;
  const status = document.getElementById("sheetStatus");
  let site = {};
  try { site = await apiGet("/site"); } catch (e) { /* leave empty */ }
  const url = site && site.statSheet;
  if (!url) {
    host.innerHTML = `
      <div class="card" style="text-align:center;padding:26px">
        <div style="font-size:30px">📋</div>
        <b>No stat sheet connected yet</b>
        <p class="mini-note" style="margin:6px auto 0;max-width:560px">Admins: open the <a href="admin.html">admin panel</a> → Preseason → <b>Live stat sheet</b> and paste a Google Sheet link (shared as “Anyone with the link → Viewer”). Stats logged in the sheet then show here automatically.</p>
      </div>`;
    return;
  }
  const load = async () => {
    try {
      const data = await fetchSheet(url);
      renderSheetTable(host, data);
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

document.addEventListener("DOMContentLoaded", initStatSheet);
