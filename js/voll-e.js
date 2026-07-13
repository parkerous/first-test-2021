/* ============================================================
   Soai — Volleyball Spike AI Dashboard  (pure JavaScript)
   Learns where you spike, your success rate, and draws heat maps.
   No server needed — everything saves in your browser.
   ============================================================ */

/* ---------- Court geometry (top-down view) ----------
   The SVG is 300 wide x 600 tall.
   Net is the horizontal line in the middle (y = 300).
   YOUR side is the bottom half (y 300..600) — where spikes come FROM.
   OPPONENT side is the top half (y 0..300) — where the ball LANDS.
   Attack lines sit 3m from the net (100px).                          */
const CW = 300, CH = 600, NET = 300;

const STORE_KEY = "volle_spikes_v1";

/* ---------- State ---------- */
let spikes = load();
let pending = null;                 // first click (spike origin) waiting for a landing click
let currentResult = "kill";         // kill | error | inplay
let heatMode = "landing";           // origin | landing | none
let filterPlayer = "ALL";

/* ---------- Storage ---------- */
function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch { return []; }
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(spikes)); }

/* ---------- Volleyball zones ----------
   Column: left / center / right by x.
   Your side rows use real volleyball position numbers:
     front row  4(left) 3(center) 2(right)
     back  row  5(left) 6(center) 1(right)                            */
function col(x) { return x < 100 ? "L" : x < 200 ? "C" : "R"; }

function yourZone(x, y) {
  const c = col(x);
  const front = y < 400;            // within 3m of net = front row
  const map = { L: front ? 4 : 5, C: front ? 3 : 6, R: front ? 2 : 1 };
  return map[c];
}

/* Direction of the attack, based on origin column vs landing column
   and how short the ball lands. */
function direction(x, y, tx, ty) {
  if (ty > 250) return "tip";                 // lands within 1.5m of net = tip/dink
  const from = col(x), to = col(tx);
  if (from === to) return "line";             // straight down the line
  return "cross";                             // angled across the court
}

/* ---------- Add / edit / delete ---------- */
function addSpike(x, y, tx, ty) {
  spikes.push({
    id: Date.now() + "-" + Math.round(x * ty),
    player: currentPlayerName(),
    x, y, tx, ty,
    zone: yourZone(x, y),
    dir: direction(x, y, tx, ty),
    result: currentResult,
  });
  save();
  render();
}

function deleteSpike(id) {
  spikes = spikes.filter(s => s.id !== id);
  save();
  render();
}

function editField(id, field, value) {
  const s = spikes.find(s => s.id === id);
  if (s) { s[field] = value; save(); render(); }
}

/* ---------- Player helpers ---------- */
function currentPlayerName() {
  const v = document.getElementById("playerName").value.trim();
  return v || "Me";
}
function allPlayers() {
  return [...new Set(spikes.map(s => s.player))].sort();
}
function visibleSpikes() {
  return filterPlayer === "ALL" ? spikes : spikes.filter(s => s.player === filterPlayer);
}

/* ============================================================
   RENDERING
   ============================================================ */
function render() {
  drawCourt();
  drawStats();
  drawInsights();
  drawTable();
  refreshPlayerFilter();
}

/* ---------- Court + heat map + dots ---------- */
function drawCourt() {
  const svg = document.getElementById("court");
  const data = visibleSpikes();

  let html = "";

  /* court background */
  html += `<rect x="0" y="0" width="${CW}" height="${CH}" rx="8" fill="#e9b872"/>`;      // sand/orange court
  html += `<rect x="0" y="0" width="${CW}" height="${NET}" fill="#d9a55f"/>`;             // opponent side slightly darker

  /* HEAT MAP cells (drawn under the lines) */
  if (heatMode !== "none") html += heatCells(data, heatMode);

  /* court lines */
  const L = 'stroke="#ffffff" stroke-width="2" fill="none"';
  html += `<rect x="4" y="4" width="${CW - 8}" height="${CH - 8}" ${L}/>`;                // outer boundary
  html += `<line x1="4" y1="${NET}" x2="${CW - 4}" y2="${NET}" stroke="#1f2a44" stroke-width="4"/>`; // net
  html += `<line x1="4" y1="${NET + 100}" x2="${CW - 4}" y2="${NET + 100}" ${L} stroke-dasharray="6 5"/>`; // your attack line
  html += `<line x1="4" y1="${NET - 100}" x2="${CW - 4}" y2="${NET - 100}" ${L} stroke-dasharray="6 5"/>`; // opp attack line
  html += `<text x="8" y="${CH - 10}" font-size="12" fill="#5a3d16">YOUR SIDE</text>`;
  html += `<text x="8" y="18" font-size="12" fill="#5a3d16">OPPONENT</text>`;

  /* individual spike dots */
  const color = { kill: "#16a34a", error: "#dc2626", inplay: "#eab308" };
  for (const s of data) {
    html += `<circle cx="${s.x}" cy="${s.y}" r="4" fill="${color[s.result]}" stroke="#fff" stroke-width="1"/>`;
    html += `<circle cx="${s.tx}" cy="${s.ty}" r="4" fill="none" stroke="${color[s.result]}" stroke-width="2"/>`;
    html += `<line x1="${s.x}" y1="${s.y}" x2="${s.tx}" y2="${s.ty}" stroke="${color[s.result]}" stroke-width="1" opacity="0.35"/>`;
  }

  /* pending origin marker */
  if (pending) html += `<circle cx="${pending.x}" cy="${pending.y}" r="6" fill="none" stroke="#2563eb" stroke-width="2"><animate attributeName="r" values="6;9;6" dur="1s" repeatCount="indefinite"/></circle>`;

  svg.innerHTML = html;
}

/* Build heat-map rectangles for one half of the court. */
function heatCells(data, mode) {
  const cols = 3, rows = 3;                        // 3x3 grid per half
  const half = NET;                                // height of one half
  const cellW = CW / cols, cellH = half / rows;
  const yOff = mode === "origin" ? NET : 0;        // origin=bottom half, landing=top half
  const counts = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (const s of data) {
    const px = mode === "origin" ? s.x : s.tx;
    const py = mode === "origin" ? s.y : s.ty;
    const localY = py - yOff;
    if (localY < 0 || localY > half) continue;
    const c = Math.min(cols - 1, Math.floor(px / cellW));
    const r = Math.min(rows - 1, Math.floor(localY / cellH));
    counts[r][c]++;
  }

  const max = Math.max(1, ...counts.flat());
  let out = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const n = counts[r][c];
      if (!n) continue;
      const t = n / max;                            // 0..1 intensity
      // fade from yellow -> orange -> red
      const hue = 55 - 55 * t;                       // 55 (yellow) down to 0 (red)
      out += `<rect x="${c * cellW}" y="${yOff + r * cellH}" width="${cellW}" height="${cellH}" fill="hsl(${hue} 90% 55%)" opacity="${0.25 + 0.55 * t}"/>`;
      out += `<text x="${c * cellW + cellW / 2}" y="${yOff + r * cellH + cellH / 2 + 4}" font-size="12" font-weight="700" fill="#1c2333" text-anchor="middle">${n}</text>`;
    }
  }
  return out;
}

/* ---------- Stat tiles ---------- */
function drawStats() {
  const data = visibleSpikes();
  const total = data.length;
  const kills = data.filter(s => s.result === "kill").length;
  const errors = data.filter(s => s.result === "error").length;
  const killPct = total ? Math.round((kills / total) * 100) : 0;
  const errPct = total ? Math.round((errors / total) * 100) : 0;

  document.getElementById("tiles").innerHTML = `
    <div class="tile"><div class="num">${total}</div><div class="lbl">Total spikes</div></div>
    <div class="tile"><div class="num good">${killPct}%</div><div class="lbl">Kill rate (${kills})</div></div>
    <div class="tile"><div class="num bad">${errPct}%</div><div class="lbl">Error rate (${errors})</div></div>
    <div class="tile"><div class="num">${allPlayers().length || 0}</div><div class="lbl">Players tracked</div></div>
  `;
}

/* ---------- AI-style scouting report ---------- */
function drawInsights() {
  const data = visibleSpikes();
  const box = document.getElementById("insights");
  if (!data.length) {
    box.innerHTML = `<p class="empty">Log a few spikes (or press “Generate demo data”) and Soai will start reading your habits here.</p>`;
    return;
  }

  const who = filterPlayer === "ALL" ? "These players" : filterPlayer;

  /* favorite zone */
  const zoneCount = tally(data.map(s => s.zone));
  const favZone = mostCommon(zoneCount);
  const zonePct = Math.round((zoneCount[favZone] / data.length) * 100);

  /* favorite direction + best (highest kill%) direction */
  const dirs = ["cross", "line", "tip"];
  const dirRows = dirs.map(d => {
    const arr = data.filter(s => s.dir === d);
    const k = arr.filter(s => s.result === "kill").length;
    return { d, n: arr.length, kill: arr.length ? Math.round((k / arr.length) * 100) : 0 };
  }).filter(r => r.n);

  const favDir = dirRows.slice().sort((a, b) => b.n - a.n)[0];
  const bestDir = dirRows.slice().sort((a, b) => b.kill - a.kill)[0];

  const zoneName = { 1: "Zone 1 (back-right)", 2: "Zone 2 (front-right)", 3: "Zone 3 (front-middle)", 4: "Zone 4 (front-left)", 5: "Zone 5 (back-left)", 6: "Zone 6 (back-middle)" };

  let html = "";
  html += `<div class="insight">${who} spike most from <b>${zoneName[favZone]}</b> — ${zonePct}% of all attacks.</div>`;
  if (favDir) html += `<div class="insight">Favorite shot: <b>${favDir.d}</b> (${Math.round((favDir.n / data.length) * 100)}% of spikes, ${favDir.kill}% kills).</div>`;
  if (bestDir) html += `<div class="insight">Most successful shot: <b>${bestDir.d}</b> with a <b>${bestDir.kill}% kill rate</b> — go to this when you need a point.</div>`;

  /* per-direction bars */
  html += `<div style="margin-top:12px">`;
  for (const r of dirRows.sort((a, b) => b.n - a.n)) {
    html += `<div style="font-size:13px;margin-bottom:2px">${cap(r.d)} — ${r.n} spikes, ${r.kill}% kills</div>
             <div class="bar"><span style="width:${r.kill}%"></span></div>`;
  }
  html += `</div>`;

  box.innerHTML = html;
}

/* ---------- Spike table (edit + delete) ---------- */
function drawTable() {
  const data = visibleSpikes().slice().reverse();
  const body = document.getElementById("tbody");
  if (!data.length) { body.innerHTML = `<tr><td colspan="5" class="empty">No spikes yet.</td></tr>`; return; }

  const zoneName = { 1: "1 back-R", 2: "2 front-R", 3: "3 front-M", 4: "4 front-L", 5: "5 back-L", 6: "6 back-M" };
  body.innerHTML = data.map(s => `
    <tr>
      <td>${escapeHtml(s.player)}</td>
      <td>${zoneName[s.zone]}</td>
      <td>${cap(s.dir)}</td>
      <td>
        <select onchange="editField('${s.id}','result',this.value)">
          <option value="kill" ${s.result === "kill" ? "selected" : ""}>Kill</option>
          <option value="error" ${s.result === "error" ? "selected" : ""}>Error</option>
          <option value="inplay" ${s.result === "inplay" ? "selected" : ""}>In-play</option>
        </select>
      </td>
      <td><button class="del" title="Delete" onclick="deleteSpike('${s.id}')">×</button></td>
    </tr>`).join("");
}

/* ---------- Player filter dropdown ---------- */
function refreshPlayerFilter() {
  const sel = document.getElementById("filterPlayer");
  const players = allPlayers();
  const cur = filterPlayer;
  sel.innerHTML = `<option value="ALL">All players</option>` +
    players.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
  sel.value = players.includes(cur) || cur === "ALL" ? cur : "ALL";
  filterPlayer = sel.value;
}

/* ============================================================
   Small helpers
   ============================================================ */
function tally(arr) { const m = {}; for (const v of arr) m[v] = (m[v] || 0) + 1; return m; }
function mostCommon(obj) { return Object.keys(obj).reduce((a, b) => (obj[b] > (obj[a] || 0) ? b : a), null); }
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* ============================================================
   Court click handling (log spikes by tapping)
   ============================================================ */
function courtPoint(evt) {
  const svg = document.getElementById("court");
  const rect = svg.getBoundingClientRect();
  const p = evt.touches ? evt.touches[0] : evt;
  const x = ((p.clientX - rect.left) / rect.width) * CW;
  const y = ((p.clientY - rect.top) / rect.height) * CH;
  return { x: clamp(x, 0, CW), y: clamp(y, 0, CH) };
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function onCourtClick(evt) {
  evt.preventDefault();
  const { x, y } = courtPoint(evt);

  if (!pending) {
    // first click = where you spiked from (must be your side / bottom half)
    if (y < NET) { setHint("👉 Click on YOUR side first (bottom half) — where you jumped to spike."); return; }
    pending = { x, y };
    setHint("Now click where the ball LANDED on the opponent side (top half).");
    drawCourt();
  } else {
    // second click = where it landed (opponent side / top half)
    if (y > NET) { setHint("👉 Click the OPPONENT side (top half) for where it landed."); return; }
    addSpike(pending.x, pending.y, x, y);
    pending = null;
    setHint("✅ Spike logged! Pick a result + player, then click again to log another.");
  }
}
function setHint(t) { document.getElementById("hint").textContent = t; }

/* ============================================================
   Demo data — realistic simulated spikes so it works today
   ============================================================ */
function generateDemo() {
  const players = ["Me", "Teammate", "Rival"];
  const profiles = {
    // each player has favorite origin zones + tendencies
    "Me":        { originX: 60,  spread: 40, cross: 0.6, tipRate: 0.1, kill: 0.55 },
    "Teammate":  { originX: 150, spread: 50, cross: 0.4, tipRate: 0.2, kill: 0.6 },
    "Rival":     { originX: 240, spread: 45, cross: 0.7, tipRate: 0.05, kill: 0.45 },
  };
  for (const name of players) {
    const pr = profiles[name];
    for (let i = 0; i < 22; i++) {
      const x = clamp(pr.originX + rand(-pr.spread, pr.spread), 15, CW - 15);
      const y = clamp(NET + rand(20, 90), NET + 10, NET + 100);      // spike from the front zone
      let tx, ty;
      if (chance(pr.tipRate)) { tx = clamp(x + rand(-40, 40), 15, CW - 15); ty = rand(NET - 60, NET - 15); } // short tip
      else if (chance(pr.cross)) { tx = clamp(CW - x + rand(-40, 40), 15, CW - 15); ty = rand(30, 180); }     // cross
      else { tx = clamp(x + rand(-25, 25), 15, CW - 15); ty = rand(30, 180); }                                // line
      const result = chance(pr.kill) ? "kill" : chance(0.5) ? "error" : "inplay";
      spikes.push({
        id: "demo-" + name + "-" + i,
        player: name, x, y, tx, ty,
        zone: yourZone(x, y), dir: direction(x, y, tx, ty), result,
      });
    }
  }
  save();
  render();
  setHint("Generated 66 demo spikes for 3 players. Try the heat-map buttons and player filter!");
}
function rand(a, b) { return a + (b - a) * pseudo(); }
function chance(p) { return pseudo() < p; }
/* tiny seeded-ish random (avoids needing Math.random in odd sandboxes) */
let _seed = 12345;
function pseudo() { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x7fffffff; }

/* ---------- Export / import / clear ---------- */
function exportData() {
  const blob = new Blob([JSON.stringify(spikes, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "volle-spikes.json";
  a.click();
}
function importData(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const arr = JSON.parse(reader.result);
      if (Array.isArray(arr)) { spikes = arr; save(); render(); setHint("Imported " + arr.length + " spikes."); }
    } catch { setHint("⚠️ That file wasn’t valid Soai data."); }
  };
  reader.readAsText(file);
}
function clearAll() {
  if (confirm("Delete ALL spikes? This can’t be undone.")) { spikes = []; save(); render(); setHint("Cleared."); }
}

/* ============================================================
   Wire up controls after the page loads
   ============================================================ */
function init() {
  const svg = document.getElementById("court");
  svg.addEventListener("click", onCourtClick);

  // result chips
  document.querySelectorAll(".res-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      currentResult = chip.dataset.result;
      document.querySelectorAll(".res-chip").forEach(c => c.classList.toggle("on", c === chip));
    });
  });

  // heat-map toggle
  document.querySelectorAll("[data-heat]").forEach(btn => {
    btn.addEventListener("click", () => {
      heatMode = btn.dataset.heat;
      document.querySelectorAll("[data-heat]").forEach(b => b.classList.toggle("on", b === btn));
      drawCourt();
    });
  });

  document.getElementById("filterPlayer").addEventListener("change", e => { filterPlayer = e.target.value; render(); });
  document.getElementById("demoBtn").addEventListener("click", generateDemo);
  document.getElementById("clearBtn").addEventListener("click", clearAll);
  document.getElementById("exportBtn").addEventListener("click", exportData);
  document.getElementById("importFile").addEventListener("change", importData);
  document.getElementById("undoBtn").addEventListener("click", () => {
    if (spikes.length) { spikes.pop(); save(); render(); setHint("Removed last spike."); }
  });

  render();
}

document.addEventListener("DOMContentLoaded", init);
