/* ============================================================
   Soai — player stats, admin-managed (backend /players).
   Every registered player is seeded with zeroed stats; admins log
   stats in the admin panel (Players tab) and the boards below update
   instantly. Leaderboard formula:
   Kills ×2 · Aces ×2 · Blocks ×2 · Digs ×1 · Assists ×1.
   Players are grouped by their FIRST listed position:
   Setter → Setters · Libero → Liberos · everything else → Hitters.
   ============================================================ */

const PSTAT_WEIGHTS = { kills: 2, aces: 2, blocks: 2, digs: 1, assists: 1 };
const PSTAT_GROUPS = ["Hitters", "Setters", "Liberos"];

function capBadge(p) { return p && p.cap ? ' <span class="capb" title="Team captain">C</span>' : ""; }
function pEsc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* Position group from the first listed position. */
function posGroup(pos) {
  const first = String(pos || "").split("/")[0].trim().toLowerCase();
  if (first.indexOf("set") === 0) return "Setters";
  if (first.indexOf("lib") === 0) return "Liberos";
  return "Hitters";
}
function playerPts(p) {
  const s = p.stats || {};
  let pts = 0;
  for (const k in PSTAT_WEIGHTS) pts += PSTAT_WEIGHTS[k] * (+s[k] || 0);
  return Math.round(pts * 10) / 10;
}

async function fetchPlayers() {
  try { return await apiGet("/players"); } catch (e) { return []; }
}

/* ---- stats page ---- */
async function renderPlayerStats() {
  const host = document.getElementById("posBoards");
  if (!host) return;
  const players = await fetchPlayers();
  const medal = ["🥇", "🥈", "🥉"];

  // --- position-split leaderboards (Hitters / Setters / Liberos) ---
  const groupIcon = { Hitters: "💥", Setters: "🤝", Liberos: "🛡️" };
  host.innerHTML = PSTAT_GROUPS.map(g => {
    const rows = players.filter(p => posGroup(p.pos) === g)
      .map(p => ({ ...p, pts: playerPts(p) }))
      .sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name))
      .slice(0, 10);
    const played = rows.some(r => r.pts > 0);
    return `
      <div class="pos-board">
        <h3 class="grp" style="margin:0 0 10px">${groupIcon[g]} ${g}</h3>
        <div class="table-scroll">
          <table class="standings">
            <thead><tr><th>#</th><th>Player</th><th>Team</th><th class="num">Pts</th></tr></thead>
            <tbody>${rows.map((p, i) => `
              <tr>
                <td class="rk">${played && p.pts > 0 ? (medal[i] || i + 1) : i + 1}</td>
                <td><b>${pEsc(p.name)}</b>${capBadge(p)}</td>
                <td>${pEsc(p.team)}</td>
                <td class="num"><b>${p.pts}</b></td>
              </tr>`).join("") || `<tr><td colspan="4" class="empty">No players yet.</td></tr>`}</tbody>
          </table>
        </div>
      </div>`;
  }).join("");

  // --- category leaders (top 3 per stat, all positions) ---
  const cats = [
    ["kills", "💥 Kills"], ["aces", "🚀 Aces"], ["blocks", "🧱 Blocks"],
    ["digs", "🛡️ Digs"], ["assists", "🤝 Assists"],
  ];
  const leadHost = document.getElementById("catLeaders");
  if (leadHost) {
    const cards = cats.map(([k, label]) => {
      const top = players.filter(p => (+((p.stats || {})[k]) || 0) > 0)
        .sort((a, b) => (+b.stats[k] || 0) - (+a.stats[k] || 0)).slice(0, 3);
      if (!top.length) return "";
      const lead = top[0];
      return `
        <div class="lp-tile lead-card">
          <h3>${label}</h3>
          <div class="lead-top">
            <div class="lead-who"><b>${pEsc(lead.name)}</b>${capBadge(lead)}<span>${pEsc(lead.team)}</span></div>
            <div class="lead-num">${lead.stats[k]}</div>
          </div>
          ${top.slice(1).map((p, i) => `<div class="lead-row"><span>${medal[i + 1]} ${pEsc(p.name)} <span style="color:var(--muted)">· ${pEsc(p.team)}</span></span><b>${p.stats[k]}</b></div>`).join("")}
        </div>`;
    }).filter(Boolean);
    const sec = leadHost.closest("section");
    if (cards.length) { leadHost.innerHTML = cards.join(""); if (sec) sec.style.display = ""; }
    else if (sec) sec.style.display = "none";
  }

  // --- full roster table with position + team filters ---
  const tblHost = document.getElementById("rosterTable");
  if (!tblHost) return;
  const teams = [...new Set(players.map(p => p.team))].sort();
  let fGroup = "All", fTeam = "";
  const draw = () => {
    const rows = players
      .filter(p => (fGroup === "All" || posGroup(p.pos) === fGroup) && (!fTeam || p.team === fTeam))
      .map(p => ({ ...p, pts: playerPts(p) }))
      .sort((a, b) => b.pts - a.pts || a.team.localeCompare(b.team) || a.name.localeCompare(b.name));
    document.getElementById("rosterGrid").innerHTML = `
      <div class="table-scroll">
        <table class="standings">
          <thead><tr><th>Player</th><th>Team</th><th>Position</th>
            <th class="num">G</th><th class="num">K</th><th class="num">A</th><th class="num">B</th>
            <th class="num">D</th><th class="num">As</th><th class="num">Pts</th></tr></thead>
          <tbody>${rows.map(p => `
            <tr>
              <td><b>${pEsc(p.name)}</b>${capBadge(p)}</td>
              <td>${pEsc(p.team)}</td>
              <td>${pEsc(p.pos || "—")}</td>
              <td class="num">${p.stats.games || 0}</td><td class="num">${p.stats.kills || 0}</td>
              <td class="num">${p.stats.aces || 0}</td><td class="num">${p.stats.blocks || 0}</td>
              <td class="num">${p.stats.digs || 0}</td><td class="num">${p.stats.assists || 0}</td>
              <td class="num"><b>${p.pts}</b></td>
            </tr>`).join("") || `<tr><td colspan="10" class="empty">No players match this filter.</td></tr>`}</tbody>
        </table>
      </div>`;
  };
  tblHost.innerHTML = `
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:12px">
      ${["All"].concat(PSTAT_GROUPS).map(g => `<button class="btn ${g === "All" ? "" : "ghost"}" data-g="${g}">${g}</button>`).join("")}
      <select id="rosterTeam" style="min-width:170px"><option value="">All teams</option>${teams.map(t => `<option>${pEsc(t)}</option>`).join("")}</select>
      <span class="mini-note" style="margin:0;align-self:center;color:var(--muted)">${players.length} registered players</span>
    </div>
    <div id="rosterGrid"></div>`;
  tblHost.querySelectorAll("button[data-g]").forEach(b => b.addEventListener("click", () => {
    fGroup = b.dataset.g;
    tblHost.querySelectorAll("button[data-g]").forEach(x => x.classList.toggle("ghost", x !== b));
    draw();
  }));
  document.getElementById("rosterTeam").addEventListener("change", e => { fTeam = e.target.value; draw(); });
  draw();
}

/* ---- homepage MVP race widget (#mvpRace) ---- */
async function initMvpRace() {
  const host = document.getElementById("mvpRace");
  if (!host) return;
  const players = await fetchPlayers();
  const rows = players.map(p => ({ ...p, pts: playerPts(p) })).filter(p => p.pts > 0)
    .sort((a, b) => b.pts - a.pts).slice(0, 3);
  if (!rows.length) { host.style.display = "none"; return; }
  const medal = ["🥇", "🥈", "🥉"];
  host.innerHTML = `
    <div class="psl-head">
      <span class="psl-eyebrow">⭐ Top Players · Official Player Leaderboard</span>
      <span class="psl-date">Logged by the league</span>
    </div>
    <div class="psl-top3">
      ${rows.map((p, i) => `<div class="psl-item"><span class="psl-rank">${i + 1}</span><span class="psl-medal">${medal[i]}</span><span class="psl-name">${pEsc(p.name)} <span style="color:var(--muted);font-weight:600">· ${pEsc(p.team)}</span></span><span class="psl-pts">${p.pts} pts</span></div>`).join("")}
    </div>
    <a class="psl-link" href="stats.html">Full stats &amp; leaderboards →</a>`;
}

document.addEventListener("DOMContentLoaded", function () { renderPlayerStats(); initMvpRace(); });
