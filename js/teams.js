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

async function loadTeams() {
  const grid = document.getElementById("teamGrid");
  if (!apiConfigured()) { grid.innerHTML = `<p class="empty">Teams will appear here once the league backend is connected.</p>`; return; }
  try {
    const teams = await apiGet("/teams");
    if (!teams.length) { grid.innerHTML = `<p class="empty">No teams yet — be the first to register!</p>`; return; }
    grid.innerHTML = teams.map(t => `
      <div class="team-card">
        <div class="head">
          <img class="team-logo" src="${esc(t.logo || "img/mikasa.svg")}" alt="" />
          <div class="nm">${esc(t.name)}</div>
        </div>
        <div class="jerseys">
          <figure><img src="${esc(t.jerseyFront || "img/mikasa.svg")}" alt="jersey front" /><figcaption>Front</figcaption></figure>
          <figure><img src="${esc(t.jerseyBack || "img/mikasa.svg")}" alt="jersey back" /><figcaption>Back</figcaption></figure>
        </div>
      </div>`).join("");
  } catch (e) { grid.innerHTML = `<p class="empty">Couldn't load teams (${esc(e.message)}).</p>`; }
}

async function submitTeam() {
  if (!apiConfigured()) { msg("⚠️ The backend isn't connected yet."); return; }
  const name = document.getElementById("tName").value.trim();
  const password = document.getElementById("tPass").value;
  if (!name || !password) { msg("Enter a team name and a password."); return; }
  if (!uploads.logo) { msg("Please add a team logo."); return; }
  msg("Submitting…");
  try {
    const res = await apiPost("/teams/register", { name, password, logo: uploads.logo, jerseyFront: uploads.front, jerseyBack: uploads.back });
    if (res.ok) {
      msg("✅ Submitted! Your team is pending admin approval — it'll appear once approved.");
      document.getElementById("tName").value = ""; document.getElementById("tPass").value = "";
      ["logo", "front", "back"].forEach(k => uploads[k] = "");
      document.querySelectorAll(".uploader").forEach(u => { u.classList.remove("has"); u.querySelector("img").src = ""; });
    } else { msg("⚠️ " + (res.error || "Something went wrong.")); }
  } catch (e) { msg("⚠️ " + e.message); }
}

function init() {
  if (!apiConfigured()) document.getElementById("cfgNotice").style.display = "block";
  wireUploader("upLogo", "logo");
  wireUploader("upFront", "front");
  wireUploader("upBack", "back");
  document.getElementById("submitBtn").addEventListener("click", submitTeam);
  loadTeams();
}
document.addEventListener("DOMContentLoaded", init);
