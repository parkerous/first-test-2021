/* ============================================================
   Soai — single team page: jerseys, roster, and roster management
   (a team edits its own players using its team password).
   ============================================================ */
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

let TEAM = null;

function rosterHtml(players) {
  if (!players || !players.length) {
    return `<p class="empty" style="padding:14px">No players added yet. The team can add them below.</p>`;
  }
  return `<ol class="roster">` + players.map(p =>
    `<li><span class="rn"></span><span class="pn">${esc(p)}</span></li>`).join("") + `</ol>`;
}

async function init() {
  const el = document.getElementById("teamDetail");
  const id = new URLSearchParams(location.search).get("id");
  if (!apiConfigured()) { el.innerHTML = `<p class="empty">Connect the league backend to view team pages.</p>`; return; }
  if (!id) { el.innerHTML = `<p class="empty">No team specified.</p>`; return; }
  try {
    const t = await apiGet("/team?id=" + encodeURIComponent(id));
    if (!t || t.error) { el.innerHTML = `<p class="empty">Team not found (or not approved yet).</p>`; return; }
    TEAM = t;
    document.title = t.name + " — Soai";
    render();
  } catch (e) { el.innerHTML = `<p class="empty">Couldn't load this team (${esc(e.message)}).</p>`; }
}

function render() {
  const t = TEAM;
  const players = Array.isArray(t.players) ? t.players : [];
  document.getElementById("teamDetail").innerHTML = `
    <div class="card">
      <div class="team-head-lg">
        <img class="team-logo" style="width:88px;height:88px" src="${esc(t.logo || "img/mikasa.svg")}" alt="" />
        <div>
          <div class="nm" style="font-size:26px;font-weight:900">${esc(t.name)}</div>
          <span class="pending-pill">${esc(t.category || "League")}</span>
          <span class="pending-pill" style="background:color-mix(in srgb, var(--gold) 22%, transparent);color:var(--gold)">👥 ${players.length} player${players.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      <h3 style="margin:18px 0 10px;color:var(--gold)">Roster</h3>
      <div id="rosterView">${rosterHtml(players)}</div>

      <h3 style="margin:22px 0 10px;color:var(--gold)">Jersey</h3>
      <div class="jerseys jerseys-big">
        <figure><img src="${esc(t.jerseyFront || "img/mikasa.svg")}" alt="jersey front" /><figcaption>Front</figcaption></figure>
        <figure><img src="${esc(t.jerseyBack || "img/mikasa.svg")}" alt="jersey back" /><figcaption>Back</figcaption></figure>
      </div>
    </div>

    <details class="card manage-card">
      <summary>✏️ Manage roster (team members)</summary>
      <p class="mini-note" style="margin-top:10px">Enter your <b>team password</b> to add or edit the players on your roster — one name per line.</p>
      <div class="row"><input id="rPass" type="password" placeholder="Team password" style="flex:1;min-width:180px" /></div>
      <div class="row" style="flex-direction:column;align-items:stretch;gap:6px">
        <textarea id="rPlayers" rows="8" placeholder="One player name per line" style="width:100%">${esc(players.join("\n"))}</textarea>
      </div>
      <div class="row"><button class="btn" id="rSave">💾 Save roster</button></div>
      <p class="msg" id="rMsg" style="color:var(--muted);font-size:13.5px;margin:6px 0 0"></p>
    </details>`;

  document.getElementById("rSave").addEventListener("click", saveRoster);
}

async function saveRoster() {
  const m = document.getElementById("rMsg");
  const password = document.getElementById("rPass").value;
  if (!password) { m.textContent = "Enter your team password."; return; }
  const players = document.getElementById("rPlayers").value.split("\n").map(s => s.trim()).filter(Boolean);
  m.textContent = "Saving…";
  try {
    const res = await apiPost("/team/roster", { id: TEAM.id, password, players }, false);
    if (res && res.ok) {
      TEAM.players = res.players || players;
      m.textContent = "✅ Roster saved!";
      document.getElementById("rosterView").innerHTML = rosterHtml(TEAM.players);
    } else {
      m.textContent = "⚠️ " + (res && res.error === "wrong team password" ? "Wrong team password." : (res && res.error) || "Couldn't save.");
    }
  } catch (e) { m.textContent = "⚠️ " + e.message; }
}

document.addEventListener("DOMContentLoaded", init);
