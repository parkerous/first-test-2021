/* ============================================================
   Soai — Admin dashboard: stats, team management (approve / reject /
   category / roster) and homepage slideshow announcements.
   ============================================================ */

let anns = [];
let TEAMS = [];

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
/* GET with the admin key — works against the remote backend or the
   in-browser one (rawGet in api.js handles both). */
async function adminGet(path) { return rawGet(path, adminKey()); }

/* ---------- login ---------- */
async function login() {
  const url = document.getElementById("apiUrl").value.trim();
  if (url) localStorage.setItem("soai_api_override", url.replace(/\/+$/, ""));
  const key = document.getElementById("adminKeyIn").value;
  const m = document.getElementById("loginMsg");
  if (!apiConfigured()) { m.textContent = "Enter the backend URL (open the details below)."; return; }
  if (!key) { m.textContent = "Enter the admin password."; return; }
  sessionStorage.setItem("soai_admin_key", key);
  m.textContent = "Checking…";
  try {
    const res = await apiPost("/admin/login", {}, true);
    if (res && res.ok) {
      document.getElementById("loginCard").style.display = "none";
      document.getElementById("panels").style.display = "block";
      document.getElementById("whoami").style.display = "inline-block";
      await loadAll();
    } else { sessionStorage.removeItem("soai_admin_key"); m.textContent = "❌ Wrong admin password."; }
  } catch (e) { m.textContent = "⚠️ " + e.message; }
}
async function loadAll() {
  anns = await apiGet("/announcements").catch(() => []);
  renderAnns();
  loadSite();
  loadRules();
  await loadScrims();
  await loadS2();
  loadHonors();   // after scrims + S2 so the team-name suggestions are filled
  loadPlayers();
}

/* ---------- player roster + stat logging ---------- */
let PLAYERS = [];
async function loadPlayers() {
  try { PLAYERS = await apiGet("/players"); } catch (e) { PLAYERS = []; }
  const teams = [...new Set(PLAYERS.map(p => p.team).concat(S2DATA.teams || []))].sort();
  const opts = teams.map(t => `<option>${esc(t)}</option>`).join("");
  const sel = document.getElementById("plTeam"), fil = document.getElementById("plFilter");
  if (sel) { const v = sel.value; sel.innerHTML = `<option value="">Team…</option>` + opts; sel.value = v; }
  if (fil) { const v = fil.value; fil.innerHTML = `<option value="">Pick a team…</option>` + opts; fil.value = v; }
  renderPlayerAdmin();
}
function renderPlayerAdmin() {
  const el = document.getElementById("playerAdmin");
  if (!el) return;
  const team = document.getElementById("plFilter").value;
  if (!team) { el.innerHTML = `<p class="empty">Pick a team above to see its players (${PLAYERS.length} loaded).</p>`; return; }
  const rows = PLAYERS.filter(p => p.team === team).sort((a, b) => a.name.localeCompare(b.name));
  if (!rows.length) { el.innerHTML = `<p class="empty">No players on ${esc(team)} yet — add one above.</p>`; return; }
  const KEYS = ["games", "kills", "aces", "blocks", "digs", "assists", "mvps"];
  const LBL = ["G", "K", "A", "B", "D", "As", "MVP"];
  el.innerHTML = rows.map(p => `
    <div class="card" style="background:var(--bg);margin-bottom:8px"><div class="row" style="align-items:center;gap:6px;flex-wrap:wrap">
      <span style="font-size:13.5px;min-width:180px"><b>${esc(p.name)}</b> <span style="color:var(--muted)">· ${esc(p.pos || "—")}</span></span>
      <span class="spacer"></span>
      ${KEYS.map((k, i) => `<label style="font-size:10.5px;color:var(--muted);display:flex;flex-direction:column;align-items:center">${LBL[i]}<input type="number" min="0" class="pl-stat" data-id="${esc(p.id)}" data-k="${k}" value="${(p.stats || {})[k] || 0}" style="width:52px;font-size:12.5px" /></label>`).join("")}
      <button class="btn ghost pl-save" data-id="${esc(p.id)}" title="Save stats">💾</button>
      <button class="btn warn pl-del" data-id="${esc(p.id)}" title="Remove player">🗑</button>
    </div></div>`).join("");
  el.querySelectorAll(".pl-save").forEach(b => b.addEventListener("click", async () => {
    const stats = {};
    el.querySelectorAll(`.pl-stat[data-id="${b.dataset.id}"]`).forEach(inp => { stats[inp.dataset.k] = +inp.value || 0; });
    const r = await apiPost("/admin/players/update", { id: b.dataset.id, stats }, true);
    if (r && r.ok) { b.textContent = "✅"; setTimeout(() => { b.textContent = "💾"; }, 1200); await loadPlayers(); }
  }));
  el.querySelectorAll(".pl-del").forEach(b => b.addEventListener("click", async () => {
    await apiPost("/admin/players/delete", { id: b.dataset.id }, true); await loadPlayers();
  }));
}
async function addPlayerAdmin() {
  const m = document.getElementById("plMsg");
  const name = document.getElementById("plName").value.trim();
  const team = document.getElementById("plTeam").value;
  const pos = document.getElementById("plPos").value;
  if (!name || !team) { m.textContent = "Name and team are required."; return; }
  const r = await apiPost("/admin/players/add", { name, team, pos }, true);
  if (r && r.ok) { m.textContent = "✅ Added"; document.getElementById("plName").value = ""; document.getElementById("plFilter").value = team; await loadPlayers(); }
  else m.textContent = "⚠️ " + ((r && r.error) || "failed");
}
async function resetPlayersAdmin() {
  await apiPost("/admin/players/reset", {}, true); await loadPlayers();
}

/* ---------- full data backup (one JSON file) ---------- */
async function downloadBackup() {
  const m = document.getElementById("backupMsg");
  m.textContent = "Collecting data…";
  const grab = p => apiGet(p).catch(() => null);
  const [site, announcements, scrims, s2, honors, rules, pickem, players] = await Promise.all([
    grab("/site"), grab("/announcements"), grab("/scrims"), grab("/s2"), grab("/honors"), grab("/rules"), grab("/pickem"), grab("/players"),
  ]);
  const backup = { site: "Binsu Star", exportedAt: new Date().toISOString(), data: { site, announcements, scrims, s2, honors, rules, pickem, players } };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "binsu-star-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(a.href);
  m.textContent = "✅ Backup downloaded.";
}

/* ---------- honors (tournament placements -> all-time rankings) ---------- */
let HONORS = [];
async function loadHonors() {
  try { HONORS = await apiGet("/honors"); } catch (e) { HONORS = []; }
  // team suggestions from the S2 list + preseason pool
  const dl = document.getElementById("hoTeamList");
  if (dl) {
    const names = new Set((S2DATA.teams || []).concat((SCRIMS.teams || []).map(t => (t && t.name) || "")));
    dl.innerHTML = [...names].filter(Boolean).sort().map(n => `<option value="${esc(n)}"></option>`).join("");
  }
  const el = document.getElementById("honorAdmin");
  if (!el) return;
  if (!HONORS.length) { el.innerHTML = `<p class="empty">Nothing recorded yet — log the first tournament placement above.</p>`; return; }
  const medals = { 1: "🥇", 2: "🥈", 3: "🥉" };
  el.innerHTML = HONORS.map(h => `
    <div class="card" style="background:var(--bg);margin-bottom:8px"><div class="row" style="align-items:center">
      <span style="font-size:13.5px">${medals[h.place]} <b>${esc(h.team)}</b> — ${esc(h.event)}${h.season ? ` <span style="color:var(--muted)">· ${esc(h.season)}</span>` : ""}</span>
      <span class="spacer"></span>
      <button class="btn warn ho-del" data-id="${esc(h.id)}">🗑</button>
    </div></div>`).join("");
  el.querySelectorAll(".ho-del").forEach(b => b.addEventListener("click", async () => {
    await apiPost("/admin/honors/delete", { id: b.dataset.id }, true); await loadHonors();
  }));
}
async function addHonor() {
  const m = document.getElementById("hoMsg");
  const team = document.getElementById("hoTeam").value.trim();
  const event = document.getElementById("hoEvent").value.trim();
  const season = document.getElementById("hoSeason").value.trim();
  const place = +document.getElementById("hoPlace").value;
  if (!team || !event) { m.textContent = "Team and tournament are required."; return; }
  m.textContent = "Saving…";
  const r = await apiPost("/admin/honors/add", { team, event, place, season }, true);
  if (r && r.ok) { m.textContent = "✅ Recorded — the all-time board is updated."; document.getElementById("hoTeam").value = ""; document.getElementById("hoEvent").value = ""; await loadHonors(); }
  else m.textContent = "⚠️ " + ((r && r.error) || "failed");
}

/* ---------- Season 2 fixtures admin ---------- */
let S2DATA = { teams: [], fixtures: [] };
async function loadS2() {
  try { S2DATA = await apiGet("/s2"); } catch (e) { S2DATA = { teams: [], fixtures: [] }; }
  const opts = `<option value="">Team…</option>` + (S2DATA.teams || []).map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
  const a = document.getElementById("fxA"), b = document.getElementById("fxB");
  if (a && b) { const av = a.value, bv = b.value; a.innerHTML = opts; b.innerHTML = opts; a.value = av; b.value = bv; }
  const ta = document.getElementById("s2Teams");
  if (ta) ta.value = (S2DATA.teams || []).join("\n");
  renderS2Admin();
}
function renderS2Admin() {
  const el = document.getElementById("fxAdmin");
  if (!el) return;
  const fx = (S2DATA.fixtures || []).slice().sort((x, y) => (x.when || Infinity) - (y.when || Infinity) || (x.createdAt || 0) - (y.createdAt || 0));
  if (!fx.length) { el.innerHTML = `<p class="empty">No fixtures yet — add the first one above.</p>`; return; }
  const stageName = { regular: "Regular", qf: "QF", sf: "SF", "3rd": "3rd", f: "Final" };
  const setsToText = sets => {
    sets = sets || [];
    if (sets.every(s => s.w === "A" || s.w === "B")) {
      // winner-only result → the same "A 2-0" shorthand the parser accepts
      const a = sets.filter(s => s.w === "A").length, b = sets.length - a;
      return a >= b ? `A ${a}-${b}` : `B ${b}-${a}`;
    }
    return sets.map(s => (typeof s.a === "number" && typeof s.b === "number") ? `${s.a}-${s.b}` : (s.w === "A" ? "A 1-0" : "B 1-0")).join(", ");
  };
  el.innerHTML = fx.map(f => `
    <div class="card" style="background:var(--bg);margin-bottom:8px">
      <div class="row" style="align-items:center;gap:8px">
        <span style="font-size:13.5px"><b>${esc(f.teamA)}</b> vs <b>${esc(f.teamB)}</b> <span style="color:var(--muted)">· ${stageName[f.stage] || f.stage}${f.when ? " · " + new Date(f.when).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}</span></span>
        <span class="spacer"></span>
        <input type="text" class="fx-sets" data-id="${esc(f.id)}" placeholder="25-20, 23-25, 15-10" value="${esc(f.sets ? setsToText(f.sets) : "")}" style="width:200px;font-size:12.5px" />
        <button class="btn ghost fx-save" data-id="${esc(f.id)}">💾</button>
        <button class="btn warn fx-del" data-id="${esc(f.id)}">🗑</button>
      </div>
    </div>`).join("");
  el.querySelectorAll(".fx-save").forEach(b => b.addEventListener("click", () => saveFxResult(b.dataset.id)));
  el.querySelectorAll(".fx-del").forEach(b => b.addEventListener("click", async () => {
    await apiPost("/admin/s2/fixture/delete", { id: b.dataset.id }, true); await loadS2();
  }));
}
/* "25-20, 23-25" → point sets; "A 2-0" / "B 2-1" → winner-only sets; "" → clear */
function parseFxSets(text) {
  const t = (text || "").trim();
  if (!t) return [];
  const ff = t.match(/^([ab])\s*(\d+)\s*-\s*(\d+)$/i);
  if (ff) {
    // "A 2-0" = team A won 2 sets to 0, no point scores recorded
    const win = ff[1].toUpperCase(), lose = win === "A" ? "B" : "A";
    const sets = [];
    for (let i = 0; i < +ff[2]; i++) sets.push({ w: win });
    for (let i = 0; i < +ff[3]; i++) sets.push({ w: lose });
    return sets;
  }
  return t.split(",").map(p => {
    const m = p.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    return m ? { a: +m[1], b: +m[2] } : null;
  }).filter(Boolean);
}
async function saveFxResult(id) {
  const inp = document.querySelector(`.fx-sets[data-id="${id}"]`);
  const sets = parseFxSets(inp ? inp.value : "");
  const r = await apiPost("/admin/s2/result", { id, sets }, true);
  if (r && r.ok) await loadS2();
}
async function addFixture() {
  const m = document.getElementById("fxMsg");
  const teamA = document.getElementById("fxA").value, teamB = document.getElementById("fxB").value;
  if (!teamA || !teamB) { m.textContent = "Pick both teams."; return; }
  if (teamA === teamB) { m.textContent = "A team can't play itself."; return; }
  const whenStr = document.getElementById("fxWhen").value;
  const when = whenStr ? new Date(whenStr).getTime() : 0;
  const stage = document.getElementById("fxStage").value;
  m.textContent = "Adding…";
  const r = await apiPost("/admin/s2/fixture/add", { teamA, teamB, stage, when }, true);
  if (r && r.ok) { m.textContent = "✅ Fixture added"; document.getElementById("fxA").value = ""; document.getElementById("fxB").value = ""; await loadS2(); }
  else m.textContent = "⚠️ " + ((r && r.error) || "failed");
}
async function saveS2Teams() {
  const m = document.getElementById("s2TeamsMsg");
  const teams = document.getElementById("s2Teams").value.split("\n").map(x => x.trim()).filter(Boolean);
  const r = await apiPost("/admin/s2/teams", { teams }, true);
  m.textContent = (r && r.ok) ? "✅ Saved" : "⚠️ " + ((r && r.error) || "failed");
  if (r && r.ok) await loadS2();
}

/* ---------- preseason scrims admin ---------- */
let SCRIMS = { teams: [], matches: [] };
let scrimSetCount = 2;
let scrimTeamCtl = null;
async function loadScrims() {
  try { SCRIMS = await apiGet("/scrims"); } catch (e) { SCRIMS = { teams: [], matches: [] }; }
  // team dropdowns (team pool entries are {name, logo})
  const names = (SCRIMS.teams || []).map(t => (t && t.name) || "").filter(Boolean);
  const opts = `<option value="">Team…</option>` + names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
  const a = document.getElementById("scA"), b = document.getElementById("scB");
  const av = a.value, bv = b.value;
  a.innerHTML = opts; b.innerHTML = opts; a.value = av; b.value = bv;
  // team editor (logo + name)
  scrimTeamCtl = makeScrimTeamEditor(document.getElementById("scTeamsEditor"), SCRIMS.teams || []);
  renderScrimSets();
  renderScrimAdmin();
}

/* rows of [logo upload][name][remove] + add button; returns { get } -> [{name,logo}] */
function makeScrimTeamEditor(mountEl, initial) {
  let teams = (initial || []).map(t => ({ name: (t && t.name) || "", logo: (t && t.logo) || "" }));
  function render() {
    mountEl.innerHTML = teams.map((t, i) => `
      <div class="pedit-row" data-i="${i}">
        <label class="pedit-photo ${t.logo ? "has" : ""}" title="Upload team logo">
          <input type="file" accept="image/*" hidden />
          ${t.logo ? `<img src="${esc(t.logo)}" alt="" />` : `<span>＋</span>`}
        </label>
        <input class="pedit-name" type="text" value="${esc(t.name)}" placeholder="Team name" />
        <button type="button" class="pedit-del" title="Remove">✕</button>
      </div>`).join("") + `<button type="button" class="pedit-add btn ghost">＋ Add team</button>`;
    mountEl.querySelectorAll(".pedit-row").forEach(row => {
      const i = +row.dataset.i;
      row.querySelector(".pedit-name").addEventListener("input", e => { teams[i].name = e.target.value; });
      row.querySelector(".pedit-photo input").addEventListener("change", async e => {
        const f = e.target.files[0]; if (!f) return;
        teams[i].logo = await fileToDataUrl(f, 300); render();
      });
      row.querySelector(".pedit-del").addEventListener("click", () => { teams.splice(i, 1); render(); });
    });
    mountEl.querySelector(".pedit-add").addEventListener("click", () => { teams.push({ name: "", logo: "" }); render(); });
  }
  render();
  return { get: () => teams.map(t => ({ name: (t.name || "").trim(), logo: t.logo || "" })).filter(t => t.name) };
}
function renderScrimSets() {
  const el = document.getElementById("scSets");
  let html = "";
  for (let i = 0; i < scrimSetCount; i++) {
    html += `<div class="row" style="align-items:center;gap:8px">
      <span style="color:var(--muted);font-size:13px;width:52px">Set ${i + 1}</span>
      <input type="number" min="0" id="scS${i}a" placeholder="A" style="width:80px" />
      <span style="color:var(--muted)">–</span>
      <input type="number" min="0" id="scS${i}b" placeholder="B" style="width:80px" />
    </div>`;
  }
  el.innerHTML = html;
}
function renderScrimAdmin() {
  const el = document.getElementById("scrimAdmin");
  const ms = (SCRIMS.matches || []).slice().sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));
  if (!ms.length) { el.innerHTML = `<p class="empty">No scrims posted yet.</p>`; return; }
  el.innerHTML = ms.map(m => {
    const line = (typeof scrimMatchLine === "function") ? scrimMatchLine(m).text : `${esc(m.teamA)} vs ${esc(m.teamB)}`;
    return `<div class="card" style="background:var(--bg);margin-bottom:8px"><div class="row" style="align-items:center">
      <span style="font-size:14px">🏐 ${line}</span><span class="spacer"></span>
      <button class="btn warn" onclick="deleteScrim('${m.id}')">🗑</button></div></div>`;
  }).join("");
}
/* show either the per-set score inputs or the result-only picker */
function toggleScrimNoScore() {
  const on = document.getElementById("scNoScore").checked;
  document.getElementById("scSets").style.display = on ? "none" : "";
  document.getElementById("scAddSetRow").style.display = on ? "none" : "";
  document.getElementById("scResultOnly").style.display = on ? "flex" : "none";
}
async function addScrim() {
  const m = document.getElementById("scMsg");
  const teamA = document.getElementById("scA").value, teamB = document.getElementById("scB").value;
  if (!teamA || !teamB) { m.textContent = "Pick both teams."; return; }
  if (teamA === teamB) { m.textContent = "A team can't scrim itself."; return; }
  const sets = [];
  if (document.getElementById("scNoScore").checked) {
    // result only: build winner-only sets (no points recorded)
    const wa = +document.getElementById("scWonA").value, wb = +document.getElementById("scWonB").value;
    if (wa === wb) { m.textContent = "Enter a decisive result (e.g. 2–0)."; return; }
    for (let i = 0; i < wa; i++) sets.push({ w: "A" });
    for (let i = 0; i < wb; i++) sets.push({ w: "B" });
  } else {
    for (let i = 0; i < scrimSetCount; i++) {
      const av = document.getElementById("scS" + i + "a").value, bv = document.getElementById("scS" + i + "b").value;
      if (av === "" && bv === "") continue;
      if (av === "" || bv === "") { m.textContent = `Set ${i + 1} needs both scores.`; return; }
      sets.push({ a: +av, b: +bv });
    }
    if (!sets.length) { m.textContent = "Enter at least one set score."; return; }
  }
  m.textContent = "Posting…";
  try {
    const r = await apiPost("/admin/scrims/add", { teamA, teamB, sets }, true);
    if (r && r.ok) {
      m.textContent = "✅ Result posted";
      document.getElementById("scA").value = ""; document.getElementById("scB").value = "";
      document.getElementById("scNoScore").checked = false; toggleScrimNoScore();
      scrimSetCount = 2; await loadScrims();
    } else m.textContent = "⚠️ " + ((r && r.error) || "failed");
  } catch (e) { m.textContent = "⚠️ " + e.message; }
}
async function deleteScrim(id) {
  if (!confirm("Delete this scrim result?")) return;
  try { await apiPost("/admin/scrims/delete", { id }, true); SCRIMS.matches = (SCRIMS.matches || []).filter(x => x.id !== id); renderScrimAdmin(); }
  catch (e) { /* ignore */ }
}
async function resetScrims() {
  if (!confirm("Restore the 4 posted preseason results and the 17-team pool? This replaces the current scrim data.")) return;
  try { await apiPost("/admin/scrims/reset", {}, true); await loadScrims(); }
  catch (e) { /* ignore */ }
}
async function saveScrimTeams() {
  const m = document.getElementById("scTeamsMsg");
  const teams = scrimTeamCtl ? scrimTeamCtl.get() : [];
  m.textContent = "Saving…";
  try {
    const r = await apiPost("/admin/scrims/teams", { teams }, true);
    if (r && r.ok) { m.textContent = "✅ Saved"; await loadScrims(); }
    else m.textContent = "⚠️ " + ((r && r.error) || "failed");
  } catch (e) { m.textContent = "⚠️ " + e.message; }
}

/* ---------- rules admin (official book + suggestions) ---------- */
let SUGGESTS = [];
async function loadRules() {
  try { const r = await apiGet("/rules"); document.getElementById("rulesText").value = (r && r.text) || ""; } catch (e) {}
  try { SUGGESTS = await adminGet("/admin/rules/suggestions"); } catch (e) { SUGGESTS = []; }
  renderSuggests();
}
async function saveRules() {
  const m = document.getElementById("rulesMsg");
  m.textContent = "Saving…";
  try {
    const r = await apiPost("/admin/rules", { text: document.getElementById("rulesText").value }, true);
    m.textContent = r && r.ok ? "✅ Saved — it's live on the Rules page." : "⚠️ " + ((r && r.error) || "failed");
  } catch (e) { m.textContent = "⚠️ " + e.message; }
}
function loadDefaultRules() {
  document.getElementById("rulesText").value = "";
  document.getElementById("rulesMsg").textContent = "Cleared — save to fall back to the built-in default book on the Rules page.";
}
function renderSuggests() {
  const el = document.getElementById("suggestAdmin");
  if (!SUGGESTS.length) { el.innerHTML = `<p class="empty">No rule suggestions yet.</p>`; return; }
  el.innerHTML = SUGGESTS.map(s => `
    <div class="card" style="background:var(--bg);margin-bottom:8px">
      <div class="row" style="align-items:center"><b>${esc(s.name || "Anonymous")}</b><span class="spacer"></span><button class="btn warn" onclick="deleteSuggest('${s.id}')">🗑</button></div>
      <p style="margin:8px 0 0;font-size:13.5px;white-space:pre-wrap">${esc(s.text)}</p>
    </div>`).join("");
}
async function deleteSuggest(id) { await apiPost("/admin/rules/suggestions/delete", { id }, true); SUGGESTS = SUGGESTS.filter(x => x.id !== id); renderSuggests(); }

/* ---------- player profile moderation (titles / verified / tagline) ---------- */
let PROFILES = [];
async function loadProfiles() {
  try { PROFILES = await apiGet("/profiles"); renderProfiles(); } catch (e) { PROFILES = []; renderProfiles(); }
}
function renderProfiles() {
  const el = document.getElementById("profileAdmin");
  if (!PROFILES.length) { el.innerHTML = `<p class="empty">No player profiles yet.</p>`; return; }
  el.innerHTML = PROFILES.map(pr => `
    <div class="card" style="background:var(--bg);margin-bottom:8px">
      <div class="row" style="align-items:center">
        <b>${esc(pr.name)}</b>${pr.verified ? ` <span class="pf-verified">✔</span>` : ""}${pr.pos ? ` <span class="pending-pill">${esc(pr.pos)}</span>` : ""}
        ${pr.roblox ? `<span class="mini-note" style="margin:0">🎮 ${esc(pr.roblox)}</span>` : ""}
        <span class="spacer"></span>
        <button class="btn warn" onclick="deleteProfile('${pr.id}')">🗑 Delete</button>
      </div>
      <div class="row" style="margin-top:8px"><input id="pt_${pr.id}" value="${esc((pr.titles || []).join(", "))}" placeholder="Titles (comma-separated) — e.g. S1 Champion, MVP" style="flex:1;min-width:200px" /></div>
      <div class="row" style="align-items:center">
        <input id="ptag_${pr.id}" value="${esc(pr.tagline || "")}" placeholder="Tagline (optional)" style="flex:1;min-width:160px" />
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted)"><input type="checkbox" id="pv_${pr.id}" ${pr.verified ? "checked" : ""} /> Verified</label>
        <button class="btn" onclick="saveTitles('${pr.id}')">💾 Save</button>
        <span class="msg" id="ptm_${pr.id}" style="color:var(--muted);font-size:12.5px"></span>
      </div>
    </div>`).join("");
}
async function saveTitles(id) {
  const m = document.getElementById("ptm_" + id);
  const titles = document.getElementById("pt_" + id).value.split(",").map(s => s.trim()).filter(Boolean);
  const tagline = document.getElementById("ptag_" + id).value.trim();
  const verified = document.getElementById("pv_" + id).checked;
  m.textContent = "Saving…";
  try {
    const r = await apiPost("/admin/profiles/titles", { id, titles, tagline, verified }, true);
    if (r && r.ok) { const pr = PROFILES.find(x => x.id === id); if (pr) { pr.titles = titles; pr.tagline = tagline; pr.verified = verified; } m.textContent = "✅ Saved"; }
    else m.textContent = "⚠️ " + ((r && r.error) || "failed");
  } catch (e) { m.textContent = "⚠️ " + e.message; }
}
async function deleteProfile(id) {
  if (!confirm("Delete this player profile?")) return;
  try { await apiPost("/admin/profiles/delete", { id }, true); PROFILES = PROFILES.filter(p => p.id !== id); renderProfiles(); }
  catch (e) { /* ignore */ }
}

/* ---------- site logo ---------- */
let brandLogo = "";
async function loadSite() {
  try {
    const s = await apiGet("/site");
    if (s && s.logo) { brandLogo = s.logo; document.getElementById("brandPreview").src = s.logo; }
  } catch (e) {}
}

async function pickBrand(input) {
  const f = input.files[0]; if (!f) return;
  brandLogo = await fileToDataUrl(f, 420);
  document.getElementById("brandPreview").src = brandLogo;
  document.getElementById("brandMsg").textContent = "Ready — click Save logo.";
}
async function saveBrand() {
  const m = document.getElementById("brandMsg");
  if (!brandLogo) { m.textContent = "Choose an image first."; return; }
  m.textContent = "Saving…";
  try {
    const r = await apiPost("/admin/site", { logo: brandLogo }, true);
    if (r && r.ok) {
      m.textContent = "✅ Saved — refresh to see it in the top bar.";
      document.querySelectorAll(".brand-logo, .topbar-brand").forEach(img => { img.src = brandLogo; });
    } else m.textContent = "⚠️ " + ((r && r.error) || "failed");
  } catch (e) { m.textContent = "⚠️ " + e.message; }
}

/* ---------- stats dashboard ---------- */
function renderStats() {
  const total = TEAMS.length;
  const pending = TEAMS.filter(t => t.status === "pending").length;
  const approved = TEAMS.filter(t => t.status === "approved").length;
  const binsu = TEAMS.filter(t => (t.category || "League") === "Binsu").length;
  const league = TEAMS.filter(t => (t.category || "League") === "League").length;
  const players = TEAMS.reduce((n, t) => n + (Array.isArray(t.players) ? t.players.length : 0), 0);
  const tile = (num, lbl, cls) => `<div class="stat"><div class="num ${cls || ""}">${num}</div><div class="lbl">${lbl}</div></div>`;
  document.getElementById("statRow").innerHTML =
    tile(total, "Teams") + tile(pending, "Pending", pending ? "bad" : "") +
    tile(approved, "Approved", "good") + tile(binsu, "Binsu") + tile(league, "League") + tile(players, "Players");
}

/* ---------- announcements ---------- */
function renderAnns() {
  document.getElementById("annList").innerHTML = anns.length ? anns.map((a, i) => `
    <div class="card" style="background:var(--bg);margin-bottom:10px">
      <div class="row"><input value="${esc(a.lg || "")}" placeholder="Tag (e.g. Announcement)" onchange="setAnn(${i},'lg',this.value)" style="width:200px" /><input value="${esc(a.title || "")}" placeholder="Headline" onchange="setAnn(${i},'title',this.value)" style="flex:1;min-width:160px" /></div>
      <div class="row"><input value="${esc(a.desc || "")}" placeholder="Short text" onchange="setAnn(${i},'desc',this.value)" style="flex:1" /></div>
      <div class="row"><input value="${esc(a.url || "")}" placeholder="Link (optional)" onchange="setAnn(${i},'url',this.value)" style="flex:1" /><label class="btn ghost" style="cursor:pointer">🖼️ Image<input type="file" accept="image/*" hidden onchange="annImg(${i},this)" /></label></div>
      <div class="row"><button class="del" title="Up" onclick="moveAnn(${i},-1)">▲</button><button class="del" title="Down" onclick="moveAnn(${i},1)">▼</button><button class="btn warn" onclick="removeAnn(${i})">Remove</button>${a.img ? `<span class="mini-note" style="margin:0">🖼️ image set</span>` : ""}</div>
    </div>`).join("") : `<p class="empty">No announcements yet — add one.</p>`;
}
function setAnn(i, k, v) { anns[i][k] = v; }
async function annImg(i, input) { const f = input.files[0]; if (f) { anns[i].img = await fileToDataUrl(f, 900); renderAnns(); } }
function moveAnn(i, d) { const j = i + d; if (j < 0 || j >= anns.length) return; [anns[i], anns[j]] = [anns[j], anns[i]]; renderAnns(); }
async function removeAnn(i) {
  anns.splice(i, 1); renderAnns();
  // persist right away so a deleted announcement can't come back on reload
  await saveAnns("🗑️ Removed — the change is saved.");
}
function addAnn() { anns.unshift({ lg: "Announcement", title: "", desc: "", url: "", img: "" }); renderAnns(); }
async function saveAnns(okMsg) {
  const m = document.getElementById("annMsg"); m.textContent = "Saving…";
  const clean = anns.filter(a => a.title && a.title.trim());
  try { const r = await apiPost("/admin/announcements", { announcements: clean }, true); m.textContent = r.ok ? (okMsg || "✅ Saved — it's live on the homepage slideshow.") : "⚠️ " + (r.error || "failed"); }
  catch (e) { m.textContent = "⚠️ " + e.message; }
}

/* ---------- team management ---------- */
function teamCard(t) {
  const pending = t.status === "pending";
  const players = normPlayers(t.players);
  return `
    <div class="team-card admin-team" style="margin-bottom:12px">
      <div class="head">
        <img class="team-logo" src="${esc(t.logo || "img/mikasa.svg")}" alt="" />
        <div class="nm">${esc(t.name)} ${pending ? `<span class="pending-pill" style="background:color-mix(in srgb,var(--bad) 22%,transparent);color:var(--bad)">pending</span>` : `<span class="pending-pill" style="background:color-mix(in srgb,var(--good) 22%,transparent);color:var(--good)">approved</span>`}
          <span class="pending-pill">${esc(t.category || "League")}</span></div>
      </div>
      <div class="jerseys"><figure><img src="${esc(t.jerseyFront || "img/mikasa.svg")}" alt="" /><figcaption>Front</figcaption></figure><figure><img src="${esc(t.jerseyBack || "img/mikasa.svg")}" alt="" /><figcaption>Back</figcaption></figure></div>

      <details class="roster-edit">
        <summary>👥 Roster (${players.length}) — names &amp; mugshots</summary>
        <div id="rost_${t.id}" class="roster-editor" style="margin-top:8px"></div>
        <div class="row" style="margin-top:6px"><button class="btn ghost" onclick="saveRoster('${t.id}')">💾 Save roster</button><span class="msg" id="rostmsg_${t.id}" style="color:var(--muted);font-size:12.5px"></span></div>
      </details>

      <details class="roster-edit">
        <summary>✏️ Edit team (name · captain · discord · images)</summary>
        <div class="row" style="margin-top:8px"><input id="en_${t.id}" value="${esc(t.name)}" placeholder="Team name" style="flex:1;min-width:180px" /></div>
        <div class="row">
          <input id="ecap_${t.id}" value="${esc(t.captain || "")}" placeholder="👑 Captain" style="flex:1;min-width:130px" />
          <input id="edis_${t.id}" value="${esc(t.discord || "")}" placeholder="💬 Discord" style="flex:1;min-width:130px" />
        </div>
        <div class="row">
          <label class="btn ghost" style="cursor:pointer">🏷️ Logo<input type="file" accept="image/*" hidden onchange="pickImg('${t.id}','logo',this)" /></label>
          <label class="btn ghost" style="cursor:pointer">🖼️ Banner<input type="file" accept="image/*" hidden onchange="pickImg('${t.id}','banner',this)" /></label>
          <label class="btn ghost" style="cursor:pointer">👕 Front<input type="file" accept="image/*" hidden onchange="pickImg('${t.id}','jerseyFront',this)" /></label>
          <label class="btn ghost" style="cursor:pointer">👕 Back<input type="file" accept="image/*" hidden onchange="pickImg('${t.id}','jerseyBack',this)" /></label>
          <button class="btn" onclick="saveTeam('${t.id}')">💾 Save</button>
        </div>
        <p class="msg" id="editmsg_${t.id}" style="color:var(--muted);font-size:12.5px;margin:2px 0 0"></p>
      </details>

      <div class="row" style="margin-top:10px;align-items:center">
        <label style="color:var(--muted);font-size:13px">Category</label>
        <select onchange="setCategory('${t.id}', this.value)">
          <option value="Binsu" ${t.category === "Binsu" ? "selected" : ""}>Binsu</option>
          <option value="League" ${t.category !== "Binsu" ? "selected" : ""}>League</option>
        </select>
        ${pending ? `<button class="btn" onclick="approve('${t.id}')">✔ Approve</button>` : ""}
        <button class="btn warn" onclick="reject('${t.id}')">${pending ? "✘ Reject" : "🗑 Remove"}</button>
      </div>
    </div>`;
}
const rosterCtl = {};   /* mounted roster editors, keyed by team id */
function renderTeamAdmin() {
  const pend = TEAMS.filter(t => t.status === "pending");
  const appr = TEAMS.filter(t => t.status === "approved");
  document.getElementById("teamAdmin").innerHTML =
    `<h3 class="grp">⏳ Pending approval (${pend.length})</h3>` +
    (pend.length ? pend.map(teamCard).join("") : `<p class="empty">Nothing waiting.</p>`) +
    `<h3 class="grp" style="margin-top:18px">✅ Approved teams (${appr.length})</h3>` +
    (appr.length ? appr.map(teamCard).join("") : `<p class="empty">No approved teams yet.</p>`);
  // mount a mugshot roster editor for every team
  TEAMS.forEach(t => {
    const el = document.getElementById("rost_" + t.id);
    if (el) rosterCtl[t.id] = makeRosterEditor(el, normPlayers(t.players));
  });
}
async function refresh() { TEAMS = await adminGet("/admin/teams").catch(() => TEAMS); renderStats(); renderTeamAdmin(); }
async function approve(id) { await apiPost("/admin/teams/approve", { id }, true); await refresh(); }
async function reject(id) { if (!confirm("Remove this team?")) return; await apiPost("/admin/teams/reject", { id }, true); await refresh(); }
async function setCategory(id, category) { await apiPost("/admin/teams/category", { id, category }, true); await refresh(); }
const edits = {};   /* pending image uploads per team, keyed by id */
async function pickImg(id, key, input) {
  const f = input.files[0]; if (!f) return;
  edits[id] = edits[id] || {};
  edits[id][key] = await fileToDataUrl(f, key === "logo" ? 420 : key === "banner" ? 1000 : 900);
  const m = document.getElementById("editmsg_" + id);
  if (m) m.textContent = "🖼️ " + key + " ready — click Save.";
}
async function saveTeam(id) {
  const m = document.getElementById("editmsg_" + id);
  const name = document.getElementById("en_" + id).value.trim();
  if (!name) { m.textContent = "Team name can't be empty."; return; }
  const captain = document.getElementById("ecap_" + id).value.trim();
  const discord = document.getElementById("edis_" + id).value.trim();
  m.textContent = "Saving…";
  try {
    const r = await apiPost("/admin/teams/update", Object.assign({ id, name, captain, discord }, edits[id] || {}), true);
    if (r && r.ok) { delete edits[id]; m.textContent = "✅ Saved"; await refresh(); }
    else m.textContent = "⚠️ " + ((r && r.error) || "failed");
  } catch (e) { m.textContent = "⚠️ " + e.message; }
}
async function saveRoster(id) {
  const m = document.getElementById("rostmsg_" + id);
  const players = rosterCtl[id] ? rosterCtl[id].get() : [];
  m.textContent = "Saving…";
  try {
    const r = await apiPost("/admin/teams/roster", { id, players }, true);
    if (r && r.ok) { const t = TEAMS.find(x => x.id === id); if (t) t.players = players; m.textContent = "✅ Saved"; renderStats(); }
    else m.textContent = "⚠️ " + ((r && r.error) || "failed");
  } catch (e) { m.textContent = "⚠️ " + e.message; }
}

/* ---------- coaching admin (coaches + requests) ---------- */
let COACHES = [], REQS = [], coachPhoto = "", coachBanner = "";
async function loadCoaching() {
  try { COACHES = await apiGet("/coaches"); } catch (e) { COACHES = []; }
  renderCoachAdmin();
  try { REQS = await adminGet("/admin/coaching/requests"); } catch (e) { REQS = []; }
  renderReqAdmin();
}
function renderCoachAdmin() {
  const el = document.getElementById("coachAdmin");
  if (!COACHES.length) { el.innerHTML = `<p class="empty">No coaches yet.</p>`; return; }
  el.innerHTML = COACHES.map(c => `
    <div class="card" style="background:var(--bg);margin-bottom:8px">
      <div class="row" style="align-items:center">
        <b>${esc(c.name)}</b>${c.pos ? ` <span class="pending-pill">${esc(c.pos)}</span>` : ""}
        ${c.discord ? `<span class="mini-note" style="margin:0">💬 ${esc(c.discord)}</span>` : ""}
        <span class="spacer"></span>
        <button class="btn warn" onclick="deleteCoach('${c.id}')">🗑 Delete</button>
      </div>
      ${c.blurb ? `<p style="margin:8px 0 0;font-size:13.5px">${esc(c.blurb)}</p>` : ""}
    </div>`).join("");
}
async function pickCoachPhoto(input) { const f = input.files[0]; if (!f) return; coachPhoto = await fileToDataUrl(f, 400); document.getElementById("coMsg").textContent = "📸 Photo ready — click Add coach."; }
async function pickCoachBanner(input) { const f = input.files[0]; if (!f) return; coachBanner = await fileToDataUrl(f, 1000); document.getElementById("coMsg").textContent = "🖼️ Banner ready — click Add coach."; }
async function addCoach() {
  const m = document.getElementById("coMsg");
  const name = document.getElementById("coName").value.trim();
  if (!name) { m.textContent = "Enter a coach name."; return; }
  m.textContent = "Adding…";
  try {
    const r = await apiPost("/admin/coaches/add", { name, pos: document.getElementById("coPos").value, discord: document.getElementById("coDiscord").value.trim(), blurb: document.getElementById("coBlurb").value.trim(), photo: coachPhoto, banner: coachBanner }, true);
    if (r && r.ok) { m.textContent = "✅ Coach added"; ["coName", "coDiscord", "coBlurb"].forEach(id => document.getElementById(id).value = ""); document.getElementById("coPos").value = ""; coachPhoto = ""; coachBanner = ""; await loadCoaching(); }
    else m.textContent = "⚠️ " + ((r && r.error) || "failed");
  } catch (e) { m.textContent = "⚠️ " + e.message; }
}
async function deleteCoach(id) { if (!confirm("Delete this coach?")) return; await apiPost("/admin/coaches/delete", { id }, true); COACHES = COACHES.filter(c => c.id !== id); renderCoachAdmin(); }
function renderReqAdmin() {
  const el = document.getElementById("reqAdmin");
  if (!REQS.length) { el.innerHTML = `<p class="empty">No coaching requests.</p>`; return; }
  el.innerHTML = REQS.map(r => `
    <div class="card" style="background:var(--bg);margin-bottom:8px">
      <div class="row" style="align-items:center"><b>${esc(r.name)}</b>${r.pos ? ` <span class="pending-pill">${esc(r.pos)}</span>` : ""}${r.roblox ? ` <span class="mini-note" style="margin:0">🎮 ${esc(r.roblox)}</span>` : ""}<span class="spacer"></span><button class="btn warn" onclick="deleteReq('${r.id}')">🗑</button></div>
      <p style="margin:8px 0 0;font-size:13.5px">${esc(r.msg)}</p>
      ${r.coach ? `<div class="mini-note" style="margin:4px 0 0">Prefers coach: ${esc(r.coach)}</div>` : ""}
    </div>`).join("");
}
async function deleteReq(id) { await apiPost("/admin/coaching/requests/delete", { id }, true); REQS = REQS.filter(x => x.id !== id); renderReqAdmin(); }

/* ---------- tabs (history-aware: back = undo, forward = redo) ---------- */
const TABS = ["teams", "ann", "players", "s2", "scrims", "honors", "rules"];
function tabFromHash() { const h = (location.hash || "").replace(/^#/, ""); return TABS.includes(h) ? h : "teams"; }
/* update just the UI (which tab + pane is shown) */
function showTab(name) {
  document.querySelectorAll(".atab").forEach(b => b.classList.toggle("on", b.dataset.tab === name));
  TABS.forEach(t => { const el = document.getElementById("pane-" + t); if (el) el.style.display = t === name ? "block" : "none"; });
}
/* clicking a tab records a history entry (a new "branch") so the browser's
   back/forward buttons undo/redo the navigation, and a refresh keeps the tab. */
function switchTab(name) {
  if (tabFromHash() === name) { showTab(name); return; }
  location.hash = name;   // pushes a history entry → fires hashchange → showTab
}

function init() {
  document.getElementById("loginBtn").addEventListener("click", login);
  document.getElementById("adminKeyIn").addEventListener("keydown", e => { if (e.key === "Enter") login(); });
  document.getElementById("addAnnBtn").addEventListener("click", addAnn);
  document.getElementById("saveAnnBtn").addEventListener("click", saveAnns);
  document.getElementById("rulesSave").addEventListener("click", saveRules);
  document.getElementById("rulesReset").addEventListener("click", loadDefaultRules);
  document.getElementById("refreshSuggestBtn").addEventListener("click", loadRules);
  document.getElementById("backupBtn").addEventListener("click", downloadBackup);
  document.getElementById("plAdd").addEventListener("click", addPlayerAdmin);
  document.getElementById("plFilter").addEventListener("change", renderPlayerAdmin);
  document.getElementById("refreshPlayersBtn").addEventListener("click", loadPlayers);
  document.getElementById("plResetBtn").addEventListener("click", resetPlayersAdmin);
  document.getElementById("hoAdd").addEventListener("click", addHonor);
  document.getElementById("refreshHonorsBtn").addEventListener("click", loadHonors);
  document.getElementById("fxAdd").addEventListener("click", addFixture);
  document.getElementById("refreshS2Btn").addEventListener("click", loadS2);
  document.getElementById("s2TeamsSave").addEventListener("click", saveS2Teams);
  document.getElementById("scAdd").addEventListener("click", addScrim);
  document.getElementById("scNoScore").addEventListener("change", toggleScrimNoScore);
  document.getElementById("scAddSet").addEventListener("click", () => { if (scrimSetCount < 5) { scrimSetCount++; renderScrimSets(); } });
  document.getElementById("scTeamsSave").addEventListener("click", saveScrimTeams);
  document.getElementById("refreshScrimBtn").addEventListener("click", loadScrims);
  document.getElementById("scResetBtn").addEventListener("click", resetScrims);
  document.getElementById("brandFile").addEventListener("change", e => pickBrand(e.target));
  document.getElementById("brandSave").addEventListener("click", saveBrand);
  document.querySelectorAll(".atab").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));
  // back/forward (undo/redo) and refresh restore the tab from the URL
  window.addEventListener("hashchange", () => showTab(tabFromHash()));
  showTab(tabFromHash());
}
document.addEventListener("DOMContentLoaded", init);
