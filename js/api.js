/* ============================================================
   Soai API client — talks to your Cloudflare Worker.
   AFTER deploying the worker (see api/SETUP.md), paste its URL below.
   ============================================================ */

// Backend lives on the Cloudflare Worker (serves the API for every site,
// including the Netlify copy). A localStorage override still wins for testing.
const SOAI_API = "https://first-test-2021.binsustar.workers.dev";

/* Points at the Worker backend by default; localStorage override wins. */
function apiBase() {
  const o = (localStorage.getItem("soai_api_override") || SOAI_API || "").replace(/\/+$/, "");
  if (o) return o;
  return (location.protocol === "http:" || location.protocol === "https:") ? location.origin : "";
}
function apiConfigured() { return !!apiBase(); }
function adminKey() { return sessionStorage.getItem("soai_admin_key") || ""; }

async function apiGet(path) {
  const r = await fetch(apiBase() + path);
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}
async function apiPost(path, body, admin) {
  const headers = { "Content-Type": "application/json" };
  if (admin) headers["X-Admin-Key"] = adminKey();
  const r = await fetch(apiBase() + path, { method: "POST", headers, body: JSON.stringify(body || {}) });
  return r.json();
}

/* ---- roster helpers (shared by team page + admin) ---- */
const PLAYER_ROLES = ["Setter", "Outside Hitter", "Middle Blocker", "Opposite", "Libero", "All Rounder", "Sub"];
function escHtml(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
/* normalise players to [{name, photo, role}] (older data was plain strings) */
function normPlayers(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(p => typeof p === "string"
    ? { name: p, photo: "", role: "" }
    : { name: (p && p.name) || "", photo: (p && p.photo) || "", role: (p && PLAYER_ROLES.includes(p.role) ? p.role : "") }
  ).filter(p => p.name);
}
/* short label for a role pill */
function roleShort(role) {
  return ({ "Setter": "S", "Outside Hitter": "OH", "Middle Blocker": "MB", "Opposite": "OPP", "Libero": "L", "All Rounder": "AR", "Sub": "SUB" })[role] || "";
}
/* read-only roster display: mugshot + name cards */
function rosterCardsHtml(players) {
  players = normPlayers(players);
  if (!players.length) return `<p class="empty" style="padding:14px">No players added yet.</p>`;
  return `<div class="roster">` + players.map((p, i) => `
    <div class="pcard">
      <div class="pshot">${p.photo ? `<img src="${escHtml(p.photo)}" alt="" />` : `<span>${escHtml((p.name[0] || "?").toUpperCase())}</span>`}</div>
      <div class="pmeta"><span class="rn">#${i + 1}${p.role ? ` · ${escHtml(p.role)}` : ""}</span><span class="pn">${escHtml(p.name)}</span></div>
    </div>`).join("") + `</div>`;
}
/* big-profile-pic roster: large square photo cards per player */
function rosterBigHtml(players) {
  players = normPlayers(players);
  if (!players.length) return `<p class="empty" style="padding:14px">No players added yet.</p>`;
  return `<div class="roster-big">` + players.map((p, i) => `
    <div class="pbig">
      <div class="shot">${p.photo ? `<img src="${escHtml(p.photo)}" alt="" />` : `<span>${escHtml((p.name[0] || "?").toUpperCase())}</span>`}${p.role ? `<span class="role-badge" title="${escHtml(p.role)}">${escHtml(roleShort(p.role))}</span>` : ""}</div>
      <div class="nm">${escHtml(p.name)}</div>
      <div class="rk">#${i + 1}${p.role ? ` · ${escHtml(p.role)}` : ""}</div>
    </div>`).join("") + `</div>`;
}

/* editable roster: rows of [mugshot upload][name][remove] + add button.
   Mount into an element; returns { get } to read the current [{name,photo}]. */
function makeRosterEditor(mountEl, initial) {
  let players = normPlayers(initial);
  function render() {
    mountEl.innerHTML = players.map((p, i) => `
      <div class="pedit-row" data-i="${i}">
        <label class="pedit-photo ${p.photo ? "has" : ""}" title="Upload mugshot">
          <input type="file" accept="image/*" hidden />
          ${p.photo ? `<img src="${escHtml(p.photo)}" alt="" />` : `<span>＋</span>`}
        </label>
        <input class="pedit-name" type="text" value="${escHtml(p.name)}" placeholder="Player name" />
        <select class="pedit-role" title="Role">
          <option value=""${p.role ? "" : " selected"}>Role…</option>
          ${PLAYER_ROLES.map(r => `<option value="${r}"${p.role === r ? " selected" : ""}>${r}</option>`).join("")}
        </select>
        <button type="button" class="pedit-del" title="Remove">✕</button>
      </div>`).join("") + `<button type="button" class="pedit-add btn ghost">＋ Add player</button>`;
    mountEl.querySelectorAll(".pedit-row").forEach(row => {
      const i = +row.dataset.i;
      row.querySelector(".pedit-name").addEventListener("input", e => { players[i].name = e.target.value; });
      row.querySelector(".pedit-role").addEventListener("change", e => { players[i].role = e.target.value; });
      row.querySelector(".pedit-photo input").addEventListener("change", async e => {
        const f = e.target.files[0]; if (!f) return;
        players[i].photo = await fileToDataUrl(f, 300); render();
      });
      row.querySelector(".pedit-del").addEventListener("click", () => { players.splice(i, 1); render(); });
    });
    mountEl.querySelector(".pedit-add").addEventListener("click", () => { players.push({ name: "", photo: "" }); render(); });
  }
  render();
  return { get: () => players.map(p => ({ name: (p.name || "").trim(), photo: p.photo || "", role: p.role || "" })).filter(p => p.name) };
}

/* shrink an uploaded image to a data URL (keeps KV small) */
function fileToDataUrl(file, max = 420) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", 0.82));
    }; img.onerror = reject; img.src = reader.result; };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}
