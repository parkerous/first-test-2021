/* ============================================================
   Soai — Rankings. Official Season 1 leaderboard (Top 5 + HMs
   per position) with score and tier grade, exactly as ranked.
   ============================================================ */

const SEASONS = {
  "Season 1": {
    "Setter": {
      top: [
        { rank: 1, name: "Envy", score: "4.85", tier: "S+" },
        { rank: 2, name: "Ami", score: "4.69", tier: "S" },
        { rank: 3, name: "Bloop", score: "4.62", tier: "S" },
        { rank: 4, name: "Atele", score: "4.60", tier: "A+" },
        { rank: 5, name: "Nyiino", score: "4.50", tier: "A+" },
      ],
      hm: [{ name: "Jemira", score: "4.39", tier: "A+" }],
    },
    "Outside": {
      top: [
        { rank: 1, name: "Rising", score: "4.90", tier: "S+" },
        { rank: 2, name: "Yoink", score: "4.74", tier: "S" },
        { rank: 3, name: "Vanity", score: "4.66", tier: "S" },
        { rank: 4, name: "Luffy", score: "4.56", tier: "S" },
        { rank: 5, name: "Prof", score: "4.42", tier: "A+" },
      ],
      hm: [
        { name: "Jupiter", score: "4.32", tier: "A+" },
        { name: "Scorpio", score: "4.26", tier: "A" },
      ],
    },
    "Middle Blocker": {
      top: [
        { rank: 1, name: "Flam", score: "4.66", tier: "S" },
        { rank: 2, name: "Choi", score: "4.61", tier: "S" },
        { rank: 3, name: "Clip", score: "4.56", tier: "S" },
        { rank: 4, name: "Maa", score: "4.51", tier: "S" },
        { rank: 5, name: "Yon", score: "4.49", tier: "A+" },
      ],
      hm: [{ name: "Power", score: "4.35", tier: "A+" }],
    },
    "Opposite": {
      top: [
        { rank: 1, name: "Lev", score: "4.830", tier: "S+" },
        { rank: 2, name: "Burnes", score: "4.590", tier: "S" },
        { rank: 3, name: "Iyaan", score: "4.430", tier: "A+" },
        { rank: 4, name: "Neo", score: "4.400", tier: "A+" },
        { rank: 5, name: "Autu", score: "4.340", tier: "A" },
      ],
      hm: [
        { name: "Haaeun", score: "3.840", tier: "B+" },
        { name: "Yf", score: "3.810", tier: "B+" },
      ],
    },
    "Libero": {
      top: [
        { rank: 1, name: "Dark", score: "4.87", tier: "S+" },
        { rank: 2, name: "Anti", score: "4.79", tier: "S" },
        { rank: 3, name: "BesRizz", score: "4.67", tier: "S" },
        { rank: 4, name: "Shawn", score: "4.62", tier: "S" },
        { rank: 5, name: "Aymzz", score: "4.54", tier: "S" },
      ],
      hm: [
        { name: "Action", score: "4.50", tier: "S" },
        { name: "Semi", score: "4.31", tier: "A" },
      ],
    },
  },
};
const POSITIONS = ["Setter", "Outside", "Middle Blocker", "Opposite", "Libero"];

let activeSeason = "Season 1";
let activePos = "Setter";

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function tierClass(t) { return ({ "S+": "t-splus", "S": "t-s", "A+": "t-aplus", "A": "t-a", "B+": "t-bplus" })[t] || "t-other"; }
function medal(r) { return r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : "#" + r; }

function row(rank, name, score, tier) {
  const label = rank === "HM" ? "HM" : medal(rank);
  const cls = rank === 1 ? "r1" : rank === "HM" ? "hm" : "";
  return `<div class="lb-row ${cls}">
    <div class="pos">${label}</div>
    <div class="nm">${esc(name)}</div>
    <div class="sc">${esc(score)}</div>
    <div class="tb ${tierClass(tier)}">${esc(tier)}</div>
  </div>`;
}

function render() {
  document.getElementById("postabs").innerHTML = POSITIONS.map(p =>
    `<button class="${p === activePos ? "on" : ""}" data-pos="${p}">${p}</button>`).join("");
  document.querySelectorAll("#postabs button").forEach(b => b.addEventListener("click", () => { activePos = b.dataset.pos; render(); }));

  const d = SEASONS[activeSeason][activePos];
  let html = `<div class="lb-head"><span>Rank</span><span>Player</span><span>Score</span><span>Tier</span></div>`;
  html += `<div class="lb">${d.top.map(p => row(p.rank, p.name, p.score, p.tier)).join("")}</div>`;
  if (d.hm && d.hm.length) {
    html += `<h3 class="hm-h">Honorable Mentions</h3>`;
    html += `<div class="lb">${d.hm.map(p => row("HM", p.name, p.score, p.tier)).join("")}</div>`;
  }
  document.getElementById("board").innerHTML = html;
}

function init() {
  document.getElementById("seasonSel").innerHTML = Object.keys(SEASONS).map(s => `<option>${s}</option>`).join("");
  document.getElementById("seasonSel").addEventListener("change", e => { activeSeason = e.target.value; render(); });
  render();
}
document.addEventListener("DOMContentLoaded", init);
