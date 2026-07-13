/* ============================================================
   Soai — single team page: banner, captain/Discord, jerseys, roster,
   a roster-change log, and team management (roster + info) with the
   team password.
   ============================================================ */
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

let TEAM = null;
let ROSTER_ED = null;
let INFO_BANNER = "";   // pending banner upload in the manage panel

function logHtml(log) {
  if (!Array.isArray(log) || !log.length) return `<p class="empty" style="padding:12px">No roster changes logged yet.</p>`;
  return `<ul class="changelog">` + log.map(e => {
    const d = new Date(e.t);
    const when = isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    return `<li><span class="cl-text">${esc(e.text)}</span><span class="cl-when">${esc(when)}</span></li>`;
  }).join("") + `</ul>`;
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
  const players = normPlayers(t.players);
  const discordLink = t.discord && /^https?:\/\//i.test(t.discord)
    ? `<a class="pending-pill dc-pill" href="${esc(t.discord)}" target="_blank" rel="noopener">💬 ${esc(t.discord)}</a>`
    : (t.discord ? `<span class="pending-pill dc-pill">💬 ${esc(t.discord)}</span>` : "");
  document.getElementById("teamDetail").innerHTML = `
    <div class="card team-card-full">
      ${t.banner ? `<div class="team-banner"><img src="${esc(t.banner)}" alt="team banner" /></div>` : ""}
      <div class="team-head-lg">
        <img class="team-logo" style="width:88px;height:88px" src="${esc(t.logo || "img/mikasa.svg")}" alt="" />
        <div>
          <div class="nm" style="font-size:26px;font-weight:900">${esc(t.name)}</div>
          <div class="ta-pills" style="margin-top:6px">
            <span class="pending-pill">${esc(t.category || "League")}</span>
            <span class="pending-pill" style="background:color-mix(in srgb, var(--gold) 22%, transparent);color:var(--gold)">👥 ${players.length} player${players.length === 1 ? "" : "s"}</span>
            ${t.captain ? `<span class="pending-pill">👑 ${esc(t.captain)}</span>` : ""}
            ${discordLink}
          </div>
        </div>
      </div>

      <h3 style="margin:18px 0 10px;color:var(--gold)">Roster</h3>
      <div id="rosterView">${rosterBigHtml(players)}</div>

      <h3 style="margin:22px 0 10px;color:var(--gold)">Jersey</h3>
      <div class="jerseys jerseys-big">
        <figure><img src="${esc(t.jerseyFront || "img/mikasa.svg")}" alt="jersey front" /><figcaption>Front</figcaption></figure>
        <figure><img src="${esc(t.jerseyBack || "img/mikasa.svg")}" alt="jersey back" /><figcaption>Back</figcaption></figure>
      </div>
    </div>

    <div class="card">
      <h3 style="margin:0 0 10px;color:var(--gold)">📋 Transfer &amp; roster-change log</h3>
      <div id="logView">${logHtml(t.log)}</div>
    </div>

    <details class="card manage-card">
      <summary>✏️ Manage team</summary>
      <p class="mini-note" style="margin-top:10px">Enter your <b>team password</b>, then edit your roster and team info below.</p>
      <div class="row"><input id="rPass" type="password" placeholder="Team password" style="flex:1;min-width:180px" /></div>

      <h4 class="mng-h">Roster — names, roles &amp; mugshots</h4>
      <div id="rEditor" class="roster-editor"></div>
      <div class="row" style="margin-top:8px"><button class="btn" id="rSave">💾 Save roster</button><span class="msg" id="rMsg" style="color:var(--muted);font-size:13px"></span></div>

      <h4 class="mng-h">Team info</h4>
      <div class="row">
        <input id="iCaptain" type="text" placeholder="👑 Captain" value="${esc(t.captain || "")}" style="flex:1;min-width:150px" />
        <input id="iDiscord" type="text" placeholder="💬 Discord handle or invite" value="${esc(t.discord || "")}" style="flex:1;min-width:150px" />
      </div>
      <div class="row" style="align-items:center">
        <label class="btn ghost" style="cursor:pointer">🖼️ Banner<input type="file" accept="image/*" hidden id="iBannerFile" /></label>
        <button class="btn" id="iSave">💾 Save info</button>
        <span class="msg" id="iMsg" style="color:var(--muted);font-size:13px"></span>
      </div>
    </details>`;

  INFO_BANNER = "";
  ROSTER_ED = makeRosterEditor(document.getElementById("rEditor"), players);
  document.getElementById("rSave").addEventListener("click", saveRoster);
  document.getElementById("iSave").addEventListener("click", saveInfo);
  document.getElementById("iBannerFile").addEventListener("change", async e => {
    const f = e.target.files[0]; if (!f) return;
    INFO_BANNER = await fileToDataUrl(f, 1000);
    document.getElementById("iMsg").textContent = "🖼️ Banner ready — click Save info.";
  });
}

async function saveRoster() {
  const m = document.getElementById("rMsg");
  const password = document.getElementById("rPass").value;
  if (!password) { m.textContent = "Enter your team password."; return; }
  const players = ROSTER_ED ? ROSTER_ED.get() : [];
  m.textContent = "Saving…";
  try {
    const res = await apiPost("/team/roster", { id: TEAM.id, password, players }, false);
    if (res && res.ok) {
      // refetch to pick up the freshly-logged changes
      const fresh = await apiGet("/team?id=" + encodeURIComponent(TEAM.id)).catch(() => null);
      if (fresh && !fresh.error) TEAM = fresh; else TEAM.players = res.players || players;
      m.textContent = "✅ Roster saved!";
      document.getElementById("rosterView").innerHTML = rosterBigHtml(TEAM.players);
      document.getElementById("logView").innerHTML = logHtml(TEAM.log);
    } else {
      m.textContent = "⚠️ " + (res && res.error === "wrong team password" ? "Wrong team password." : (res && res.error) || "Couldn't save.");
    }
  } catch (e) { m.textContent = "⚠️ " + e.message; }
}

async function saveInfo() {
  const m = document.getElementById("iMsg");
  const password = document.getElementById("rPass").value;
  if (!password) { m.textContent = "Enter your team password (top of this panel)."; return; }
  const payload = { id: TEAM.id, password, captain: document.getElementById("iCaptain").value.trim(), discord: document.getElementById("iDiscord").value.trim() };
  if (INFO_BANNER) payload.banner = INFO_BANNER;
  m.textContent = "Saving…";
  try {
    const res = await apiPost("/team/info", payload, false);
    if (res && res.ok && res.team) { TEAM = res.team; render(); document.getElementById("iMsg").textContent = "✅ Team info saved!"; }
    else m.textContent = "⚠️ " + (res && res.error === "wrong team password" ? "Wrong team password." : (res && res.error) || "Couldn't save.");
  } catch (e) { m.textContent = "⚠️ " + e.message; }
}

document.addEventListener("DOMContentLoaded", init);
