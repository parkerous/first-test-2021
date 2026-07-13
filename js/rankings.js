/* ============================================================
   Soai — Rankings: official Season 1 Top 10 per position
   (rank, name, final rating, tier grade). HM = honorable mention.
   ============================================================ */

const SEASONS = {
  "Season 1": {
    "Setter": [
      { rank: 1, name: "Envy", score: "4.85", tier: "S+" },
      { rank: 2, name: "Ami", score: "4.69", tier: "S" },
      { rank: 3, name: "Bloop", score: "4.62", tier: "S" },
      { rank: 4, name: "Atele", score: "4.60", tier: "A+" },
      { rank: 5, name: "Nyiino", score: "4.50", tier: "A+" },
      { rank: 6, name: "Jemira", score: "4.39", tier: "A+", hm: true },
      { rank: 7, name: "Coas", score: "4.18", tier: "A" },
      { rank: 8, name: "Why", score: "3.93", tier: "B+" },
      { rank: 9, name: "Qarz", score: "4.18", tier: "B+" },
    ],
    "Outside": [
      { rank: 1, name: "Rising", score: "4.90", tier: "S+" },
      { rank: 2, name: "Yoink", score: "4.74", tier: "S" },
      { rank: 3, name: "Vanity", score: "4.66", tier: "S" },
      { rank: 4, name: "Luffy", score: "4.56", tier: "S" },
      { rank: 5, name: "Prof", score: "4.42", tier: "A+" },
      { rank: 6, name: "Jupiter", score: "4.32", tier: "A+", hm: true },
      { rank: 7, name: "Scorpio", score: "4.26", tier: "A", hm: true },
      { rank: 8, name: "Veldora", score: "4.10", tier: "A" },
      { rank: 9, name: "Taco", score: "3.98", tier: "B+" },
      { rank: 10, name: "Vex", score: "3.90", tier: "B+" },
    ],
    "Middle Blocker": [
      { rank: 1, name: "Flam", score: "4.66", tier: "S" },
      { rank: 2, name: "Choi", score: "4.61", tier: "S" },
      { rank: 3, name: "Clip", score: "4.56", tier: "S" },
      { rank: 4, name: "Maa", score: "4.51", tier: "S" },
      { rank: 5, name: "Yon", score: "4.49", tier: "A+" },
      { rank: 6, name: "Power", score: "4.35", tier: "A+", hm: true },
      { rank: 7, name: "Nova", score: "4.32", tier: "A+" },
      { rank: 8, name: "Tar", score: "4.29", tier: "A" },
      { rank: 9, name: "Varrap", score: "4.20", tier: "A" },
      { rank: 10, name: "Diamond", score: "4.19", tier: "A" },
    ],
    "Opposite": [
      { rank: 1, name: "Lev", score: "4.830", tier: "S+" },
      { rank: 2, name: "Burnes", score: "4.590", tier: "S" },
      { rank: 3, name: "Iyaan", score: "4.430", tier: "A+" },
      { rank: 4, name: "Neo", score: "4.400", tier: "A+" },
      { rank: 5, name: "Autu", score: "4.340", tier: "A" },
      { rank: 6, name: "Haaeun", score: "3.840", tier: "B+", hm: true },
      { rank: 7, name: "Yf", score: "3.810", tier: "B+", hm: true },
      { rank: 8, name: "Fenrir", score: "3.800", tier: "B" },
      { rank: 9, name: "Ichi", score: "3.510", tier: "B" },
      { rank: 10, name: "Clownsie", score: "3.340", tier: "C+" },
    ],
    "Libero": [
      { rank: 1, name: "Dark", score: "4.87", tier: "S+" },
      { rank: 2, name: "Anti", score: "4.79", tier: "S" },
      { rank: 3, name: "BesRizz", score: "4.67", tier: "S" },
      { rank: 4, name: "Shawn", score: "4.62", tier: "S" },
      { rank: 5, name: "Aymzz", score: "4.54", tier: "S" },
      { rank: 6, name: "Action", score: "4.50", tier: "S", hm: true },
      { rank: 7, name: "Semi", score: "4.31", tier: "A", hm: true },
      { rank: 8, name: "Savior", score: "4.26", tier: "A" },
      { rank: 9, name: "Keeno", score: "4.23", tier: "A" },
      { rank: 10, name: "Mori", score: "4.17", tier: "A" },
    ],
  },
};
const POSITIONS = ["Setter", "Outside", "Middle Blocker", "Opposite", "Libero"];

let activeSeason = "Season 1";
let activePos = "Setter";

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function tierClass(t) { return ({ "S+": "t-splus", "S": "t-s", "A+": "t-aplus", "A": "t-a", "B+": "t-bplus" })[t] || "t-other"; }
function medal(r) { return r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : "#" + r; }

function row(p) {
  const cls = p.rank === 1 ? "r1" : "";
  return `<div class="lb-row ${cls}">
    <div class="pos">${medal(p.rank)}</div>
    <div class="nm">${esc(p.name)}${p.hm ? ` <span class="hm-chip">HM</span>` : ""}</div>
    <div class="sc">${esc(p.score)}</div>
    <div class="tb ${tierClass(p.tier)}">${esc(p.tier)}</div>
  </div>`;
}

function render() {
  document.getElementById("postabs").innerHTML = POSITIONS.map(p =>
    `<button class="${p === activePos ? "on" : ""}" data-pos="${p}">${p}</button>`).join("");
  document.querySelectorAll("#postabs button").forEach(b => b.addEventListener("click", () => { activePos = b.dataset.pos; render(); }));

  const list = SEASONS[activeSeason][activePos] || [];
  document.getElementById("board").innerHTML =
    `<div class="lb-head"><span>Rank</span><span>Player</span><span>Rating</span><span>Tier</span></div>` +
    `<div class="lb">${list.map(row).join("")}</div>`;
}

function init() {
  document.getElementById("seasonSel").innerHTML = Object.keys(SEASONS).map(s => `<option>${s}</option>`).join("");
  document.getElementById("seasonSel").addEventListener("change", e => { activeSeason = e.target.value; render(); });
  render();
}
document.addEventListener("DOMContentLoaded", init);
