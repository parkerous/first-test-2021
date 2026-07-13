/* ============================================================
   Soai — Admin panel: slideshow announcements + team approvals.
   Requires the deployed Cloudflare Worker (api/SETUP.md) and the
   admin password (Cloudflare secret ADMIN_KEY).
   ============================================================ */

let anns = [];

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
  if (!apiConfigured()) { m.textContent = "Enter the backend URL (or set SOAI_API in js/api.js)."; return; }
  if (!key) { m.textContent = "Enter the admin password."; return; }
  sessionStorage.setItem("soai_admin_key", key);
  m.textContent = "Checking…";
  try {
    const res = await apiPost("/admin/login", {}, true);
    if (res && res.ok) {
      document.getElementById("loginCard").style.display = "none";
      document.getElementById("panels").style.display = "block";
      await loadAll();
    } else { sessionStorage.removeItem("soai_admin_key"); m.textContent = "❌ Wrong admin password."; }
  } catch (e) { m.textContent = "⚠️ " + e.message; }
}
async function loadAll() {
  anns = await apiGet("/announcements").catch(() => []);
  renderAnns();
  const teams = await adminGet("/admin/teams").catch(() => []);
  renderTeamAdmin(teams);
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

/* ---------- team approvals ---------- */
function renderTeamAdmin(list) {
  const pend = list.filter(t => t.status === "pending");
  const appr = list.filter(t => t.status === "approved");
  const card = (t, pending) => `
    <div class="team-card" style="margin-bottom:10px">
      <div class="head"><img class="team-logo" src="${esc(t.logo || "img/mikasa.svg")}" alt="" /><div class="nm">${esc(t.name)} ${pending ? `<span class="pending-pill">pending</span>` : ""}</div></div>
      <div class="jerseys"><figure><img src="${esc(t.jerseyFront || "img/mikasa.svg")}" alt="" /><figcaption>Front</figcaption></figure><figure><img src="${esc(t.jerseyBack || "img/mikasa.svg")}" alt="" /><figcaption>Back</figcaption></figure></div>
      <div class="row" style="margin-top:10px">${pending ? `<button class="btn" onclick="approve('${t.id}')">✔ Approve</button>` : ""}<button class="btn warn" onclick="reject('${t.id}')">${pending ? "✘ Reject" : "🗑 Remove"}</button></div>
    </div>`;
  document.getElementById("teamAdmin").innerHTML =
    `<h3 style="color:var(--gold);font-size:15px">Pending (${pend.length})</h3>` +
    (pend.length ? pend.map(t => card(t, true)).join("") : `<p class="empty">Nothing waiting.</p>`) +
    `<h3 style="color:var(--gold);font-size:15px;margin-top:16px">Approved (${appr.length})</h3>` +
    (appr.length ? appr.map(t => card(t, false)).join("") : `<p class="empty">No approved teams yet.</p>`);
}
async function approve(id) { await apiPost("/admin/teams/approve", { id }, true); renderTeamAdmin(await adminGet("/admin/teams")); }
async function reject(id) { if (!confirm("Remove this team?")) return; await apiPost("/admin/teams/reject", { id }, true); renderTeamAdmin(await adminGet("/admin/teams")); }

function init() {
  document.getElementById("loginBtn").addEventListener("click", login);
  document.getElementById("adminKeyIn").addEventListener("keydown", e => { if (e.key === "Enter") login(); });
  document.getElementById("addAnnBtn").addEventListener("click", addAnn);
  document.getElementById("saveAnnBtn").addEventListener("click", saveAnns);
}
document.addEventListener("DOMContentLoaded", init);
