/* ============================================================
   Soai — Player Profiles: players create their own profile
   (name, Roblox username, preferred position, bio, photo) and can
   edit it with their password. Admins award titles & verification.
   ============================================================ */
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

let PROFILES = [];
let newAvatar = "";
const editAvatar = {};   // pending avatar upload per profile id (edit)

function fillPositions(sel) {
  (typeof PLAYER_ROLES !== "undefined" ? PLAYER_ROLES : []).forEach(r => {
    const o = document.createElement("option"); o.value = r; o.textContent = r; sel.appendChild(o);
  });
}

function card(pr) {
  const initial = (pr.name[0] || "?").toUpperCase();
  return `
    <div class="pf-card">
      <div class="pf-head">
        <div class="pf-avatar">${pr.photo ? `<img src="${esc(pr.photo)}" alt="" />` : `<span>${esc(initial)}</span>`}</div>
        <div class="pf-id">
          <div class="pf-name">${esc(pr.name)}${pr.verified ? ` <span class="pf-verified" title="Verified by admin">✔</span>` : ""}</div>
          ${pr.roblox ? `<div class="pf-roblox">🎮 ${esc(pr.roblox)}</div>` : ""}
        </div>
      </div>
      <div class="pf-pills">
        ${pr.pos ? `<span class="pending-pill">${esc(pr.pos)}</span>` : ""}
        ${(pr.titles || []).map(t => `<span class="title-badge">🏅 ${esc(t)}</span>`).join("")}
      </div>
      ${pr.tagline ? `<p class="pf-tagline">“${esc(pr.tagline)}”</p>` : ""}
      ${pr.bio ? `<p class="pf-bio">${esc(pr.bio)}</p>` : ""}
      <details class="pf-edit">
        <summary>✏️ Edit (your password)</summary>
        <div class="row" style="margin-top:8px"><input type="password" id="ep_${pr.id}" placeholder="Your password" style="flex:1;min-width:140px" /></div>
        <div class="row"><input id="en2_${pr.id}" value="${esc(pr.name)}" placeholder="Name" style="flex:1;min-width:120px" /><input id="er_${pr.id}" value="${esc(pr.roblox || "")}" placeholder="Roblox username" style="flex:1;min-width:120px" /></div>
        <div class="row">
          <select id="epos_${pr.id}" class="pos-sel" data-cur="${esc(pr.pos || "")}" style="min-width:150px"><option value="">Position…</option></select>
          <label class="btn ghost" style="cursor:pointer">📸 Photo<input type="file" accept="image/*" hidden onchange="pickAvatar('${pr.id}',this)" /></label>
        </div>
        <div class="row" style="flex-direction:column;align-items:stretch;gap:6px"><textarea id="eb_${pr.id}" rows="2" placeholder="Short bio">${esc(pr.bio || "")}</textarea></div>
        <div class="row"><button class="btn" onclick="saveProfile('${pr.id}')">💾 Save</button><span class="msg" id="em_${pr.id}" style="color:var(--muted);font-size:12.5px"></span></div>
      </details>
    </div>`;
}

function render() {
  const grid = document.getElementById("profileGrid");
  if (!PROFILES.length) { grid.innerHTML = `<p class="empty">No player profiles yet — make the first one above!</p>`; return; }
  grid.innerHTML = PROFILES.map(card).join("");
  // fill each edit position select + preselect current
  grid.querySelectorAll(".pos-sel").forEach(sel => { fillPositions(sel); sel.value = sel.dataset.cur || ""; });
}

async function load() {
  const grid = document.getElementById("profileGrid");
  if (!apiConfigured()) { document.getElementById("cfgNotice").style.display = "block"; grid.innerHTML = `<p class="empty">Profiles will appear once the backend is connected.</p>`; return; }
  try { PROFILES = await apiGet("/profiles"); render(); }
  catch (e) { grid.innerHTML = `<p class="empty">Couldn't load profiles (${esc(e.message)}).</p>`; }
}

async function createProfile() {
  const m = document.getElementById("createMsg");
  if (!apiConfigured()) { m.textContent = "⚠️ Profiles aren't connected yet."; return; }
  const name = document.getElementById("cName").value.trim();
  const password = document.getElementById("cPass").value;
  if (!name || !password) { m.textContent = "Enter a display name and a password."; return; }
  const body = {
    name, password,
    roblox: document.getElementById("cRoblox").value.trim(),
    pos: document.getElementById("cPos").value,
    bio: document.getElementById("cBio").value.trim(),
    photo: newAvatar,
  };
  m.textContent = "Creating…";
  try {
    const res = await apiPost("/profiles/create", body);
    if (res && res.ok) {
      m.textContent = "✅ Profile created!";
      ["cName", "cRoblox", "cBio", "cPass"].forEach(id => document.getElementById(id).value = "");
      document.getElementById("cPos").value = ""; newAvatar = "";
      const up = document.getElementById("cUpAvatar"); up.classList.remove("has"); up.querySelector("img").src = "";
      await load();
    } else { m.textContent = "⚠️ " + ((res && res.error) || "Couldn't create."); }
  } catch (e) { m.textContent = "⚠️ " + e.message; }
}

async function pickAvatar(id, input) {
  const f = input.files[0]; if (!f) return;
  editAvatar[id] = await fileToDataUrl(f, 400);
  const m = document.getElementById("em_" + id); if (m) m.textContent = "📸 Photo ready — click Save.";
}
async function saveProfile(id) {
  const m = document.getElementById("em_" + id);
  const password = document.getElementById("ep_" + id).value;
  if (!password) { m.textContent = "Enter your password."; return; }
  const body = {
    id, password,
    name: document.getElementById("en2_" + id).value.trim(),
    roblox: document.getElementById("er_" + id).value.trim(),
    pos: document.getElementById("epos_" + id).value,
    bio: document.getElementById("eb_" + id).value.trim(),
  };
  if (editAvatar[id]) body.photo = editAvatar[id];
  m.textContent = "Saving…";
  try {
    const res = await apiPost("/profile/update", body);
    if (res && res.ok) { delete editAvatar[id]; m.textContent = "✅ Saved!"; await load(); }
    else m.textContent = "⚠️ " + (res && res.error === "wrong password" ? "Wrong password." : (res && res.error) || "Couldn't save.");
  } catch (e) { m.textContent = "⚠️ " + e.message; }
}

function wireAvatar() {
  const el = document.getElementById("cUpAvatar");
  const input = el.querySelector("input"), img = el.querySelector("img");
  input.addEventListener("change", async () => {
    const f = input.files[0]; if (!f) return;
    newAvatar = await fileToDataUrl(f, 400); img.src = newAvatar; el.classList.add("has");
  });
}

function init() {
  if (!apiConfigured()) document.getElementById("cfgNotice").style.display = "block";
  fillPositions(document.getElementById("cPos"));
  wireAvatar();
  document.getElementById("createBtn").addEventListener("click", createProfile);
  load();
}
document.addEventListener("DOMContentLoaded", init);
