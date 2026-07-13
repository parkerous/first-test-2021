/* ============================================================
   Soai — Teams: register (pending admin approval) + display approved
   ============================================================ */

const uploads = { logo: "", front: "", back: "" };

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
      const n = Array.isArray(t.players) ? t.players.length : 0;
      return `
      <a class="team-card" href="team.html?id=${encodeURIComponent(t.id)}" style="text-decoration:none;color:inherit;display:block">
        <div class="head">
          <img class="team-logo" src="${esc(t.logo || "img/mikasa.svg")}" alt="" />
          <div><div class="nm">${esc(t.name)}</div><span class="pending-pill">${esc(t.category || "League")}</span></div>
        </div>
        <div class="jerseys">
          <figure><img src="${esc(t.jerseyFront || "img/mikasa.svg")}" alt="jersey front" /><figcaption>Front</figcaption></figure>
          <figure><img src="${esc(t.jerseyBack || "img/mikasa.svg")}" alt="jersey back" /><figcaption>Back</figcaption></figure>
        </div>
        <div class="roster-mini">${n ? `👥 ${n} player${n === 1 ? "" : "s"}` : "👥 No roster yet"}</div>
        <div class="mini-note" style="margin:8px 0 0;color:var(--gold);font-weight:700">View team page →</div>
      </a>`;
    }).join("");
  } catch (e) { grid.innerHTML = `<p class="empty">Couldn't load teams (${esc(e.message)}).</p>`; }
}

async function submitTeam() {
  if (!apiConfigured()) { msg("⚠️ The backend isn't connected yet."); return; }
  const name = document.getElementById("tName").value.trim();
  const password = document.getElementById("tPass").value;
  const category = document.getElementById("tCat").value;
  const players = document.getElementById("tPlayers").value.split("\n").map(s => s.trim()).filter(Boolean);
  if (!name || !password) { msg("Enter a team name and a password."); return; }
  if (!uploads.logo) { msg("Please add a team logo."); return; }
  msg("Submitting…");
  try {
    const res = await apiPost("/teams/register", { name, password, category, players, logo: uploads.logo, jerseyFront: uploads.front, jerseyBack: uploads.back });
    if (res.ok) {
      msg("✅ Submitted! Your team is pending admin approval — it'll appear once approved.");
      document.getElementById("tName").value = ""; document.getElementById("tPass").value = ""; document.getElementById("tPlayers").value = "";
      ["logo", "front", "back"].forEach(k => uploads[k] = "");
      document.querySelectorAll(".uploader").forEach(u => { u.classList.remove("has"); u.querySelector("img").src = ""; });
    } else { msg("⚠️ " + (res.error || "Something went wrong.")); }
  } catch (e) { msg("⚠️ " + e.message); }
}

function init() {
  if (!apiConfigured()) document.getElementById("cfgNotice").style.display = "block";
  const cat = getCat(); if (cat) document.getElementById("tCat").value = cat;   // preselect from the menu
  wireUploader("upLogo", "logo");
  wireUploader("upFront", "front");
  wireUploader("upBack", "back");
  document.getElementById("submitBtn").addEventListener("click", submitTeam);
  loadTeams();
}
document.addEventListener("DOMContentLoaded", init);
