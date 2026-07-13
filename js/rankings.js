/* ============================================================
   Soai — Rankings: a tier list (S/A/B/C/D) for every position.
   Pure ranking, no stats. Saved in your browser; export/import to share.
   ============================================================ */

const RANK_KEY = "soai_rankings_v1";
const POSITIONS = ["Setter", "Outside", "Opposite", "Middle", "Libero"];
const TIERS = ["S", "A", "B", "C", "D"];
const TIER_NOTE = { S: "elite", A: "great", B: "solid", C: "okay", D: "dev" };

let data = load();
let activePos = "Setter";

function load() {
  let d = {};
  try { d = JSON.parse(localStorage.getItem(RANK_KEY)) || {}; } catch { d = {}; }
  for (const p of POSITIONS) if (!Array.isArray(d[p])) d[p] = [];
  return d;
}
function save() { localStorage.setItem(RANK_KEY, JSON.stringify(data)); }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* ---------- add / edit ---------- */
function addPlayer() {
  const name = document.getElementById("pl").value.trim();
  const pos = document.getElementById("pos").value;
  const tier = document.getElementById("tier").value;
  if (!name) { document.getElementById("pl").focus(); return; }
  data[pos].push({ name, tier });
  save();
  activePos = pos;
  document.getElementById("pl").value = "";
  render();
  document.getElementById("pl").focus();
}
function removePlayer(pos, i) { data[pos].splice(i, 1); save(); render(); }
function bumpTier(pos, i, dir) {
  const p = data[pos][i]; if (!p) return;
  const idx = TIERS.indexOf(p.tier);
  const ni = Math.max(0, Math.min(TIERS.length - 1, idx + dir));
  p.tier = TIERS[ni]; save(); render();
}

/* ---------- render ---------- */
function render() {
  // tabs
  document.getElementById("postabs").innerHTML = POSITIONS.map(p =>
    `<button class="${p === activePos ? "on" : ""}" data-pos="${p}">${p} <span style="opacity:.6">${data[p].length}</span></button>`
  ).join("");
  document.querySelectorAll("#postabs button").forEach(b => b.addEventListener("click", () => { activePos = b.dataset.pos; render(); }));

  // keep the add-form position in sync with the active tab
  document.getElementById("pos").value = activePos;

  // tier rows for the active position
  const list = data[activePos];
  document.getElementById("tierlist").innerHTML = TIERS.map(t => {
    const players = list.map((p, i) => ({ ...p, i })).filter(p => p.tier === t);
    const chips = players.length
      ? players.map((p, k) => `
        <span class="chip">
          <span class="rank">${k + 1}</span>
          <span class="nm">${esc(p.name)}</span>
          <button title="Move up a tier" onclick="bumpTier('${activePos}',${p.i},-1)">▲</button>
          <button title="Move down a tier" onclick="bumpTier('${activePos}',${p.i},1)">▼</button>
          <button class="rm" title="Remove" onclick="removePlayer('${activePos}',${p.i})">×</button>
        </span>`).join("")
      : `<span class="empty-t">— no players in ${t} tier yet —</span>`;
    return `<div class="tier" data-t="${t}"><div class="lbl">${t}<small>${TIER_NOTE[t]}</small></div><div class="chips">${chips}</div></div>`;
  }).join("");
}

/* ---------- export / import / reset ---------- */
function exportData() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "soai-rankings.json"; a.click();
}
function importData(evt) {
  const f = evt.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { try { const d = JSON.parse(r.result); for (const p of POSITIONS) if (!Array.isArray(d[p])) d[p] = []; data = d; save(); render(); } catch { alert("That wasn't a valid rankings file."); } };
  r.readAsText(f);
}
function clearPos() { if (confirm("Clear all players in " + activePos + "?")) { data[activePos] = []; save(); render(); } }

/* ---------- init ---------- */
function init() {
  document.getElementById("pos").innerHTML = POSITIONS.map(p => `<option value="${p}">${p}</option>`).join("");
  document.getElementById("tier").innerHTML = TIERS.map(t => `<option value="${t}">${t} tier</option>`).join("");
  document.getElementById("tier").value = "A";

  document.getElementById("addBtn").addEventListener("click", addPlayer);
  document.getElementById("pl").addEventListener("keydown", e => { if (e.key === "Enter") addPlayer(); });
  document.getElementById("exportBtn").addEventListener("click", exportData);
  document.getElementById("importFile").addEventListener("change", importData);
  document.getElementById("clearBtn").addEventListener("click", clearPos);

  render();
}
document.addEventListener("DOMContentLoaded", init);
