/* ============================================================
   Soai — Teams: register (pending admin approval) + display approved
   ============================================================ */

const uploads = { logo: "", banner: "", front: "", back: "" };

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function msg(t) { document.getElementById("regMsg").textContent = t; }

function wireUploader(id, key) {
  const el = document.getElementById(id);
  const input = el.querySelector("input");
  const img = el.querySelector("img");
  input.addEventListener("change", async () => {
    const f = input.files[0];
    if (!f) return;
    uploads[key] = await fileToDataUrl(f);
    img.src = uploads[key]; el.classList.add("has");
  });
}

function getCat() { const c = new URLSearchParams(location.search).get("cat"); return c === "Binsu" || c === "League" ? c : ""; }

async function loadTeams() {
  const grid = document.getElementById("teamGrid");
  const cat = getCat();
  document.getElementById("teamsHeading").textContent = cat ? `Teams in ${cat}` : "All teams";
  if (!apiConfigured()) { grid.innerHTML = `<p class="empty">Teams will appear here once the league backend is connected.</p>`; return; }
  try {
    const teams = await apiGet("/teams" + (cat ? "?category=" + encodeURIComponent(cat) : ""));
    if (!teams.length) { grid.innerHTML = `<p class="empty">No teams${cat ? " in " + cat : ""} yet — be the first to register!</p>`; return; }
    grid.innerHTML = teams.map(t => {
      const players = normPlayers(t.players);
      const n = players.length;
      return `
      <details class="team-acc">
        <summary>
          <img class="team-logo" src="${esc(t.logo || "img/mikasa.svg")}" alt="" />
          <div class="ta-meta">
            <div class="nm">${esc(t.name)}</div>
            <div class="ta-pills"><span class="pending-pill">${esc(t.category || "League")}</span><span class="pending-pill">👥 ${n} player${n === 1 ? "" : "s"}</span>${t.captain ? `<span class="pending-pill">👑 ${esc(t.captain)}</span>` : ""}</div>
          </div>
          <span class="ta-chev" aria-hidden="true">▾</span>
        </summary>
        <div class="ta-body">
          ${t.banner ? `<div class="team-banner"><img src="${esc(t.banner)}" alt="team banner" /></div>` : ""}
          ${t.discord ? `<p class="ta-discord">💬 ${/^https?:\/\//i.test(t.discord) ? `<a href="${esc(t.discord)}" target="_blank" rel="noopener">${esc(t.discord)}</a>` : esc(t.discord)}</p>` : ""}
          <h4 class="ta-h">Roster</h4>
          ${rosterBigHtml(players)}
          <div class="jerseys" style="margin-top:16px">
            <figure><img src="${esc(t.jerseyFront || "img/mikasa.svg")}" alt="jersey front" /><figcaption>Jersey front</figcaption></figure>
            <figure><img src="${esc(t.jerseyBack || "img/mikasa.svg")}" alt="jersey back" /><figcaption>Jersey back</figcaption></figure>
          </div>
          <a class="btn ghost ta-open" href="team.html?id=${encodeURIComponent(t.id)}">Open full team page →</a>
        </div>
      </details>`;
    }).join("");
  } catch (e) { grid.innerHTML = `<p class="empty">Couldn't load teams (${esc(e.message)}).</p>`; }
}

async function submitTeam() {
  if (!apiConfigured()) { msg("⚠️ The backend isn't connected yet."); return; }
  const name = document.getElementById("tName").value.trim();
  const password = document.getElementById("tPass").value;
  const category = document.getElementById("tCat").value;
  const players = document.getElementById("tPlayers").value.split("\n").map(s => s.trim()).filter(Boolean);
  const captain = document.getElementById("tCaptain").value.trim();
  const discord = document.getElementById("tDiscord").value.trim();
  if (!name || !password) { msg("Enter a team name and a password."); return; }
  if (!uploads.logo) { msg("Please add a team logo."); return; }
  msg("Submitting…");
  try {
    const res = await apiPost("/teams/register", { name, password, category, players, captain, discord, logo: uploads.logo, banner: uploads.banner, jerseyFront: uploads.front, jerseyBack: uploads.back });
    if (res.ok) {
      msg("✅ Submitted! Your team is pending admin approval — it'll appear once approved.");
      ["tName", "tPass", "tPlayers", "tCaptain", "tDiscord"].forEach(id => document.getElementById(id).value = "");
      ["logo", "banner", "front", "back"].forEach(k => uploads[k] = "");
      document.querySelectorAll(".uploader").forEach(u => { u.classList.remove("has"); u.querySelector("img").src = ""; });
    } else { msg("⚠️ " + (res.error || "Something went wrong.")); }
  } catch (e) { msg("⚠️ " + e.message); }
}

function init() {
  if (!apiConfigured()) document.getElementById("cfgNotice").style.display = "block";
  const cat = getCat(); if (cat) document.getElementById("tCat").value = cat;   // preselect from the menu
  wireUploader("upLogo", "logo");
  wireUploader("upBanner", "banner");
  wireUploader("upFront", "front");
  wireUploader("upBack", "back");
  document.getElementById("submitBtn").addEventListener("click", submitTeam);
  loadTeams();
}
document.addEventListener("DOMContentLoaded", init);
