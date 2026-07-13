/* ============================================================
   Soai — Admin dashboard: stats, team management (approve / reject /
   category / roster) and homepage slideshow announcements.
   ============================================================ */

let anns = [];
let TEAMS = [];

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
async function adminGet(path) {
  const r = await fetch(apiBase() + path, { headers: { "X-Admin-Key": adminKey() } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

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
  TEAMS = await adminGet("/admin/teams").catch(() => []);
  renderStats();
  renderTeamAdmin();
  loadSite();
}

/* ---------- site logo ---------- */
let brandLogo = "";
async function loadSite() {
  try { const s = await apiGet("/site"); if (s && s.logo) { brandLogo = s.logo; document.getElementById("brandPreview").src = s.logo; } } catch (e) {}
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
function removeAnn(i) { anns.splice(i, 1); renderAnns(); }
function addAnn() { anns.unshift({ lg: "Announcement", title: "", desc: "", url: "", img: "" }); renderAnns(); }
async function saveAnns() {
  const m = document.getElementById("annMsg"); m.textContent = "Saving…";
  const clean = anns.filter(a => a.title && a.title.trim());
  try { const r = await apiPost("/admin/announcements", { announcements: clean }, true); m.textContent = r.ok ? "✅ Saved — it's live on the homepage slideshow." : "⚠️ " + (r.error || "failed"); }
  catch (e) { m.textContent = "⚠️ " + e.message; }
}

/* ---------- team management ---------- */
function teamCard(t) {
  const pending = t.status === "pending";
  const players = Array.isArray(t.players) ? t.players : [];
  return `
    <div class="team-card admin-team" style="margin-bottom:12px">
      <div class="head">
        <img class="team-logo" src="${esc(t.logo || "img/mikasa.svg")}" alt="" />
        <div class="nm">${esc(t.name)} ${pending ? `<span class="pending-pill" style="background:color-mix(in srgb,var(--bad) 22%,transparent);color:var(--bad)">pending</span>` : `<span class="pending-pill" style="background:color-mix(in srgb,var(--good) 22%,transparent);color:var(--good)">approved</span>`}
          <span class="pending-pill">${esc(t.category || "League")}</span></div>
      </div>
      <div class="jerseys"><figure><img src="${esc(t.jerseyFront || "img/mikasa.svg")}" alt="" /><figcaption>Front</figcaption></figure><figure><img src="${esc(t.jerseyBack || "img/mikasa.svg")}" alt="" /><figcaption>Back</figcaption></figure></div>

      <details class="roster-edit">
        <summary>👥 Roster (${players.length})</summary>
        <textarea id="rost_${t.id}" rows="6" placeholder="One player name per line" style="width:100%;margin-top:8px">${esc(players.join("\n"))}</textarea>
        <div class="row" style="margin-top:6px"><button class="btn ghost" onclick="saveRoster('${t.id}')">💾 Save roster</button><span class="msg" id="rostmsg_${t.id}" style="color:var(--muted);font-size:12.5px"></span></div>
      </details>

      <details class="roster-edit">
        <summary>✏️ Edit team (name · logo · jerseys)</summary>
        <div class="row" style="margin-top:8px"><input id="en_${t.id}" value="${esc(t.name)}" placeholder="Team name" style="flex:1;min-width:180px" /></div>
        <div class="row">
          <label class="btn ghost" style="cursor:pointer">🏷️ Logo<input type="file" accept="image/*" hidden onchange="pickImg('${t.id}','logo',this)" /></label>
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
function renderTeamAdmin() {
  const pend = TEAMS.filter(t => t.status === "pending");
  const appr = TEAMS.filter(t => t.status === "approved");
  document.getElementById("teamAdmin").innerHTML =
    `<h3 class="grp">⏳ Pending approval (${pend.length})</h3>` +
    (pend.length ? pend.map(teamCard).join("") : `<p class="empty">Nothing waiting.</p>`) +
    `<h3 class="grp" style="margin-top:18px">✅ Approved teams (${appr.length})</h3>` +
    (appr.length ? appr.map(teamCard).join("") : `<p class="empty">No approved teams yet.</p>`);
}
async function refresh() { TEAMS = await adminGet("/admin/teams").catch(() => TEAMS); renderStats(); renderTeamAdmin(); }
async function approve(id) { await apiPost("/admin/teams/approve", { id }, true); await refresh(); }
async function reject(id) { if (!confirm("Remove this team?")) return; await apiPost("/admin/teams/reject", { id }, true); await refresh(); }
async function setCategory(id, category) { await apiPost("/admin/teams/category", { id, category }, true); await refresh(); }
const edits = {};   /* pending image uploads per team, keyed by id */
async function pickImg(id, key, input) {
  const f = input.files[0]; if (!f) return;
  edits[id] = edits[id] || {};
  edits[id][key] = await fileToDataUrl(f, key === "logo" ? 420 : 900);
  const m = document.getElementById("editmsg_" + id);
  if (m) m.textContent = "🖼️ " + key + " ready — click Save.";
}
async function saveTeam(id) {
  const m = document.getElementById("editmsg_" + id);
  const name = document.getElementById("en_" + id).value.trim();
  if (!name) { m.textContent = "Team name can't be empty."; return; }
  m.textContent = "Saving…";
  try {
    const r = await apiPost("/admin/teams/update", Object.assign({ id, name }, edits[id] || {}), true);
    if (r && r.ok) { delete edits[id]; m.textContent = "✅ Saved"; await refresh(); }
    else m.textContent = "⚠️ " + ((r && r.error) || "failed");
  } catch (e) { m.textContent = "⚠️ " + e.message; }
}
async function saveRoster(id) {
  const m = document.getElementById("rostmsg_" + id);
  const players = document.getElementById("rost_" + id).value.split("\n").map(s => s.trim()).filter(Boolean);
  m.textContent = "Saving…";
  try {
    const r = await apiPost("/admin/teams/roster", { id, players }, true);
    if (r && r.ok) { const t = TEAMS.find(x => x.id === id); if (t) t.players = players; m.textContent = "✅ Saved"; renderStats(); }
    else m.textContent = "⚠️ " + ((r && r.error) || "failed");
  } catch (e) { m.textContent = "⚠️ " + e.message; }
}

/* ---------- tabs ---------- */
function switchTab(name) {
  document.querySelectorAll(".atab").forEach(b => b.classList.toggle("on", b.dataset.tab === name));
  document.getElementById("pane-teams").style.display = name === "teams" ? "block" : "none";
  document.getElementById("pane-ann").style.display = name === "ann" ? "block" : "none";
}

function init() {
  document.getElementById("loginBtn").addEventListener("click", login);
  document.getElementById("adminKeyIn").addEventListener("keydown", e => { if (e.key === "Enter") login(); });
  document.getElementById("addAnnBtn").addEventListener("click", addAnn);
  document.getElementById("saveAnnBtn").addEventListener("click", saveAnns);
  document.getElementById("refreshBtn").addEventListener("click", refresh);
  document.getElementById("brandFile").addEventListener("change", e => pickBrand(e.target));
  document.getElementById("brandSave").addEventListener("click", saveBrand);
  document.querySelectorAll(".atab").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));
}
document.addEventListener("DOMContentLoaded", init);
