/* ============================================================
   Soai API client.

   By default the site runs on a built-in backend that lives right in
   your browser (see local-backend at the bottom of this file), so the
   whole site works with NO server to deploy or maintain.

   If you ever deploy the Cloudflare Worker (api-worker.js) and want all
   visitors to share the same data, open the admin page → "Backend not
   connected? Set it manually" and paste the Worker URL once. That URL is
   saved as `soai_api_override` and every page will use it from then on.
   ============================================================ */

// No hard-coded remote backend: empty means "use the in-browser backend".
const SOAI_API = "";

/* Old builds hard-coded a Cloudflare Worker URL and saved it as an override.
   That Worker is gone, so a leftover copy in a visitor's browser would keep
   the site pointed at a dead host. Drop those known-dead values on load so
   the site heals itself back to the in-browser backend. */
(function clearDeadOverride() {
  try {
    const dead = ["first-test-2021.binsustar.workers.dev", "first-test-2021.workers.dev"];
    const cur = localStorage.getItem("soai_api_override") || "";
    if (dead.some(d => cur.indexOf(d) !== -1)) localStorage.removeItem("soai_api_override");
  } catch (e) { /* ignore */ }
})();

/* The remote backend URL, if one has been set. Empty => use local backend. */
function remoteBase() {
  return (localStorage.getItem("soai_api_override") || SOAI_API || "").replace(/\/+$/, "");
}
/* Kept for callers that build URLs directly. */
function apiBase() { return remoteBase(); }
/* The site always has a working backend (remote if set, else in-browser). */
function apiConfigured() { return true; }
function adminKey() { return sessionStorage.getItem("soai_admin_key") || ""; }

/* GET a route. `adminHdr` (optional) is sent as the admin key.
   If a remote backend is configured but unreachable / errors, fall back to
   the in-browser backend so the site never shows "Load failed". */
async function rawGet(path, adminHdr) {
  const base = remoteBase();
  if (base) {
    try {
      const headers = {};
      if (adminHdr) headers["X-Admin-Key"] = adminHdr;
      const r = await fetch(base + path, { headers });
      if (r.ok) return await r.json();
    } catch (e) { /* remote down — fall through to the local backend */ }
  }
  const res = await window.localBackend.route(path, "GET", null, adminHdr || "");
  if (res.status >= 400) throw new Error("HTTP " + res.status);
  return res.data;
}
async function apiGet(path) { return rawGet(path, ""); }

async function apiPost(path, body, admin) {
  const base = remoteBase();
  if (base) {
    try {
      const headers = { "Content-Type": "application/json" };
      if (admin) headers["X-Admin-Key"] = adminKey();
      const r = await fetch(base + path, { method: "POST", headers, body: JSON.stringify(body || {}) });
      if (r.ok) return await r.json();
    } catch (e) { /* remote down — fall through to the local backend */ }
  }
  const res = await window.localBackend.route(path, "POST", body || {}, admin ? adminKey() : "");
  return res.data;
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
      <div class="shot">${p.photo ? `<img src="${escHtml(p.photo)}" alt="" />` : `<span>${escHtml((p.name[0] || "?").toUpperCase())}</span>`}</div>
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

/* ============================================================
   In-browser backend — mirrors the Cloudflare Worker API (api-worker.js)
   against localStorage, so the site works with no server. Used whenever
   no remote backend URL has been set (see remoteBase above).
   Data is stored in THIS browser only; deploy the Worker + set its URL
   if you want every visitor to share the same data.
   ============================================================ */
(function () {
  const NS = "soai_kv:";                 // localStorage key prefix for our "KV"
  const ADMIN_DEFAULT = "64928";         // same default as the Worker
  const ROLES = ["Setter", "Outside Hitter", "Middle Blocker", "Opposite", "Libero", "All Rounder", "Sub"];

  const kvGet = k => localStorage.getItem(NS + k);
  const kvPut = (k, v) => localStorage.setItem(NS + k, v);
  const kvDelete = k => localStorage.removeItem(NS + k);
  function kvList(prefix) {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.indexOf(NS + prefix) === 0) out.push(key.slice(NS.length));
    }
    return out;
  }

  async function sha256(s) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  const cleanStr = (s, n) => String(s == null ? "" : s).trim().slice(0, n);
  const uid = pfx => pfx + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function cleanPlayers(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(p => {
      if (typeof p === "string") return { name: p.trim().slice(0, 40), photo: "", role: "" };
      if (p && typeof p === "object") return {
        name: cleanStr(p.name, 40), photo: typeof p.photo === "string" ? p.photo : "",
        role: ROLES.includes(p.role) ? p.role : "",
      };
      return null;
    }).filter(p => p && p.name).slice(0, 30);
  }
  const cleanTitles = arr => Array.isArray(arr) ? arr.map(s => cleanStr(s, 30)).filter(Boolean).slice(0, 6) : [];
  function diffPlayers(oldArr, newArr) {
    const norm = a => (Array.isArray(a) ? a : []).map(p => typeof p === "string" ? { name: p, role: "" } : { name: (p && p.name) || "", role: (p && p.role) || "" }).filter(p => p.name);
    const o = norm(oldArr), n = norm(newArr);
    const oNames = new Set(o.map(p => p.name)), nNames = new Set(n.map(p => p.name));
    const oRole = Object.fromEntries(o.map(p => [p.name, p.role]));
    const out = [];
    for (const p of n) if (!oNames.has(p.name)) out.push(`＋ ${p.name} joined${p.role ? ` (${p.role})` : ""}`);
    for (const p of o) if (!nNames.has(p.name)) out.push(`－ ${p.name} left`);
    for (const p of n) if (oNames.has(p.name) && (oRole[p.name] || "") !== (p.role || "")) out.push(`↺ ${p.name}: ${oRole[p.name] || "—"} → ${p.role || "—"}`);
    return out;
  }
  function appendLog(t, texts) {
    if (!Array.isArray(t.log)) t.log = [];
    const now = Date.now();
    for (const text of texts) t.log.push({ t: now, text });
    if (t.log.length > 100) t.log = t.log.slice(-100);
  }
  const publicCoach = c => ({ id: c.id, name: c.name, pos: c.pos || "", discord: c.discord || "", blurb: c.blurb || "", photo: c.photo || "", banner: c.banner || "", createdAt: c.createdAt });
  const publicProfile = pr => ({ id: pr.id, name: pr.name, roblox: pr.roblox || "", pos: pr.pos || "", bio: pr.bio || "", photo: pr.photo || "", titles: Array.isArray(pr.titles) ? pr.titles : [], verified: !!pr.verified, tagline: pr.tagline || "", createdAt: pr.createdAt });
  const publicTeam = t => ({ id: t.id, name: t.name, status: t.status, category: t.category || "League", logo: t.logo, banner: t.banner || "", captain: t.captain || "", discord: t.discord || "", jerseyFront: t.jerseyFront, jerseyBack: t.jerseyBack, players: Array.isArray(t.players) ? t.players : [], log: Array.isArray(t.log) ? t.log.slice(-30).reverse() : [], createdAt: t.createdAt });

  function localAdminKey() { return localStorage.getItem("soai_admin_key_local") || ADMIN_DEFAULT; }
  const isAdmin = hdr => !!(hdr && hdr === localAdminKey());
  const ok = (data, status = 200) => ({ status, data });
  const err = (msg, status) => ({ status, data: { error: msg } });

  /* Route a request. Returns { status, data }. Mirrors handleApi in api-worker.js. */
  async function route(rawPath, method, body, adminHdr) {
    const qi = rawPath.indexOf("?");
    const query = new URLSearchParams(qi >= 0 ? rawPath.slice(qi) : "");
    let p = (qi >= 0 ? rawPath.slice(0, qi) : rawPath).replace(/\/+$/, "") || "/";
    body = body || {};

    /* ---- announcements ---- */
    if (p === "/announcements" && method === "GET") { const a = kvGet("announcements"); return ok(a ? JSON.parse(a) : []); }
    if (p === "/admin/announcements" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      kvPut("announcements", JSON.stringify(Array.isArray(body.announcements) ? body.announcements : [])); return ok({ ok: true });
    }

    /* ---- teams ---- */
    if (p === "/teams/register" && method === "POST") {
      if (!body.name || !body.password) return err("name and password are required", 400);
      const id = uid("t_");
      const team = {
        id, name: String(body.name).slice(0, 60), status: "pending",
        category: body.category === "Binsu" ? "Binsu" : "League",
        logo: body.logo || "", banner: body.banner || "",
        captain: cleanStr(body.captain, 40), discord: cleanStr(body.discord, 40),
        jerseyFront: body.jerseyFront || "", jerseyBack: body.jerseyBack || "",
        players: cleanPlayers(body.players), log: [],
        passHash: await sha256(body.password), createdAt: Date.now(),
      };
      kvPut("team:" + id, JSON.stringify(team)); return ok({ ok: true, id });
    }
    if (p === "/teams" && method === "GET") {
      const cat = query.get("category");
      const out = [];
      for (const key of kvList("team:")) {
        const t = JSON.parse(kvGet(key));
        if (t.status !== "approved") continue;
        if (cat && (t.category || "League") !== cat) continue;
        out.push(publicTeam(t));
      }
      out.sort((a, b) => a.createdAt - b.createdAt);
      return ok(out);
    }
    if (p === "/team" && method === "GET") {
      const raw = kvGet("team:" + query.get("id"));
      if (!raw) return err("not found", 404);
      const t = JSON.parse(raw);
      if (t.status !== "approved") return err("not found", 404);
      return ok(publicTeam(t));
    }
    if (p === "/admin/teams" && method === "GET") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const out = kvList("team:").map(k => publicTeam(JSON.parse(kvGet(k))));
      out.sort((a, b) => a.createdAt - b.createdAt);
      return ok(out);
    }
    if (p === "/admin/teams/approve" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const raw = kvGet("team:" + body.id); if (!raw) return err("not found", 404);
      const t = JSON.parse(raw); t.status = "approved"; kvPut("team:" + body.id, JSON.stringify(t)); return ok({ ok: true });
    }
    if (p === "/admin/teams/reject" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      kvDelete("team:" + body.id); return ok({ ok: true });
    }
    if (p === "/admin/teams/category" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const raw = kvGet("team:" + body.id); if (!raw) return err("not found", 404);
      const t = JSON.parse(raw); t.category = body.category === "Binsu" ? "Binsu" : "League"; kvPut("team:" + body.id, JSON.stringify(t)); return ok({ ok: true });
    }
    if (p === "/team/roster" && method === "POST") {
      const raw = kvGet("team:" + body.id); if (!raw) return err("not found", 404);
      const t = JSON.parse(raw);
      if (t.passHash !== await sha256(body.password || "")) return err("wrong team password", 403);
      const changes = diffPlayers(t.players, body.players);
      t.players = cleanPlayers(body.players); appendLog(t, changes);
      kvPut("team:" + body.id, JSON.stringify(t)); return ok({ ok: true, players: t.players });
    }
    if (p === "/team/info" && method === "POST") {
      const raw = kvGet("team:" + body.id); if (!raw) return err("not found", 404);
      const t = JSON.parse(raw);
      if (t.passHash !== await sha256(body.password || "")) return err("wrong team password", 403);
      if (typeof body.captain === "string") { const v = cleanStr(body.captain, 40); if (v !== (t.captain || "")) appendLog(t, [`👑 Captain set to ${v || "—"}`]); t.captain = v; }
      if (typeof body.discord === "string") t.discord = cleanStr(body.discord, 40);
      if (typeof body.banner === "string" && body.banner) t.banner = body.banner;
      kvPut("team:" + body.id, JSON.stringify(t)); return ok({ ok: true, team: publicTeam(t) });
    }
    if (p === "/admin/teams/roster" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const raw = kvGet("team:" + body.id); if (!raw) return err("not found", 404);
      const t = JSON.parse(raw);
      const changes = diffPlayers(t.players, body.players);
      t.players = cleanPlayers(body.players); appendLog(t, changes);
      kvPut("team:" + body.id, JSON.stringify(t)); return ok({ ok: true });
    }
    if (p === "/admin/teams/update" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const raw = kvGet("team:" + body.id); if (!raw) return err("not found", 404);
      const t = JSON.parse(raw);
      if (typeof body.name === "string" && body.name.trim()) t.name = body.name.trim().slice(0, 60);
      if (body.category) t.category = body.category === "Binsu" ? "Binsu" : "League";
      if (typeof body.logo === "string" && body.logo) t.logo = body.logo;
      if (typeof body.banner === "string" && body.banner) t.banner = body.banner;
      if (typeof body.captain === "string") { const v = cleanStr(body.captain, 40); if (v !== (t.captain || "")) appendLog(t, [`👑 Captain set to ${v || "—"}`]); t.captain = v; }
      if (typeof body.discord === "string") t.discord = cleanStr(body.discord, 40);
      if (typeof body.jerseyFront === "string" && body.jerseyFront) t.jerseyFront = body.jerseyFront;
      if (typeof body.jerseyBack === "string" && body.jerseyBack) t.jerseyBack = body.jerseyBack;
      kvPut("team:" + body.id, JSON.stringify(t)); return ok({ ok: true });
    }

    /* ---- player profiles ---- */
    if (p === "/profiles" && method === "GET") {
      const out = kvList("profile:").map(k => publicProfile(JSON.parse(kvGet(k))));
      out.sort((a, b) => (b.verified - a.verified) || (a.createdAt - b.createdAt));
      return ok(out);
    }
    if (p === "/profile" && method === "GET") {
      const raw = kvGet("profile:" + query.get("id")); if (!raw) return err("not found", 404);
      return ok(publicProfile(JSON.parse(raw)));
    }
    if (p === "/profiles/create" && method === "POST") {
      const name = cleanStr(body.name, 40);
      if (!name || !body.password) return err("name and password are required", 400);
      const id = uid("u_");
      const pr = { id, name, roblox: cleanStr(body.roblox, 40), pos: ROLES.includes(body.pos) ? body.pos : "", bio: cleanStr(body.bio, 200), photo: body.photo || "", titles: [], verified: false, tagline: "", passHash: await sha256(body.password), createdAt: Date.now() };
      kvPut("profile:" + id, JSON.stringify(pr)); return ok({ ok: true, id });
    }
    if (p === "/profile/update" && method === "POST") {
      const raw = kvGet("profile:" + body.id); if (!raw) return err("not found", 404);
      const pr = JSON.parse(raw);
      if (pr.passHash !== await sha256(body.password || "")) return err("wrong password", 403);
      if (typeof body.name === "string" && body.name.trim()) pr.name = cleanStr(body.name, 40);
      if (typeof body.roblox === "string") pr.roblox = cleanStr(body.roblox, 40);
      if (body.pos !== undefined) pr.pos = ROLES.includes(body.pos) ? body.pos : "";
      if (typeof body.bio === "string") pr.bio = cleanStr(body.bio, 200);
      if (typeof body.photo === "string" && body.photo) pr.photo = body.photo;
      kvPut("profile:" + body.id, JSON.stringify(pr)); return ok({ ok: true, profile: publicProfile(pr) });
    }
    if (p === "/admin/profiles/titles" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const raw = kvGet("profile:" + body.id); if (!raw) return err("not found", 404);
      const pr = JSON.parse(raw);
      pr.titles = cleanTitles(body.titles);
      if (typeof body.verified === "boolean") pr.verified = body.verified;
      if (typeof body.tagline === "string") pr.tagline = cleanStr(body.tagline, 60);
      kvPut("profile:" + body.id, JSON.stringify(pr)); return ok({ ok: true });
    }
    if (p === "/admin/profiles/delete" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      kvDelete("profile:" + body.id); return ok({ ok: true });
    }

    /* ---- coaching ---- */
    if (p === "/coaches" && method === "GET") {
      const out = kvList("coach:").map(k => publicCoach(JSON.parse(kvGet(k))));
      out.sort((a, b) => a.createdAt - b.createdAt);
      return ok(out);
    }
    if (p === "/admin/coaches/add" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const name = cleanStr(body.name, 40); if (!name) return err("name is required", 400);
      const id = uid("c_");
      const c = { id, name, pos: ROLES.includes(body.pos) ? body.pos : "", discord: cleanStr(body.discord, 60), blurb: cleanStr(body.blurb, 200), photo: body.photo || "", banner: body.banner || "", createdAt: Date.now() };
      kvPut("coach:" + id, JSON.stringify(c)); return ok({ ok: true, id });
    }
    if (p === "/admin/coaches/delete" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      kvDelete("coach:" + body.id); return ok({ ok: true });
    }
    if (p === "/coaching/request" && method === "POST") {
      const name = cleanStr(body.name, 40), msg = cleanStr(body.msg, 280);
      if (!name || !msg) return err("name and message are required", 400);
      const raw = kvGet("coachreqs"); const list = raw ? JSON.parse(raw) : [];
      list.unshift({ id: uid("r_"), name, roblox: cleanStr(body.roblox, 40), pos: ROLES.includes(body.pos) ? body.pos : "", coach: cleanStr(body.coach, 40), msg, createdAt: Date.now() });
      if (list.length > 200) list.length = 200;
      kvPut("coachreqs", JSON.stringify(list)); return ok({ ok: true });
    }
    if (p === "/admin/coaching/requests" && method === "GET") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const raw = kvGet("coachreqs"); return ok(raw ? JSON.parse(raw) : []);
    }
    if (p === "/admin/coaching/requests/delete" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const raw = kvGet("coachreqs"); const list = (raw ? JSON.parse(raw) : []).filter(x => x.id !== body.id);
      kvPut("coachreqs", JSON.stringify(list)); return ok({ ok: true });
    }

    /* ---- league rules ---- */
    if (p === "/rules" && method === "GET") { return ok({ text: kvGet("rules") || "" }); }
    if (p === "/admin/rules" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      kvPut("rules", String(body.text == null ? "" : body.text).slice(0, 20000)); return ok({ ok: true });
    }
    if (p === "/rules/suggest" && method === "POST") {
      const text = cleanStr(body.text, 500); if (!text) return err("a rule suggestion is required", 400);
      const raw = kvGet("rulesuggest"); const list = raw ? JSON.parse(raw) : [];
      list.unshift({ id: uid("rs_"), name: cleanStr(body.name, 40), text, createdAt: Date.now() });
      if (list.length > 200) list.length = 200;
      kvPut("rulesuggest", JSON.stringify(list)); return ok({ ok: true });
    }
    if (p === "/admin/rules/suggestions" && method === "GET") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const raw = kvGet("rulesuggest"); return ok(raw ? JSON.parse(raw) : []);
    }
    if (p === "/admin/rules/suggestions/delete" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const raw = kvGet("rulesuggest"); const list = (raw ? JSON.parse(raw) : []).filter(x => x.id !== body.id);
      kvPut("rulesuggest", JSON.stringify(list)); return ok({ ok: true });
    }

    /* ---- match analysis ---- */
    if (p === "/analyses" && method === "GET") {
      const out = kvList("analysis:").map(k => { const a = JSON.parse(kvGet(k)); return { id: a.id, label: a.label, createdAt: a.createdAt }; });
      out.sort((a, b) => b.createdAt - a.createdAt); return ok(out);
    }
    if (p === "/analysis" && method === "GET") {
      const raw = kvGet("analysis:" + query.get("id")); if (!raw) return err("not found", 404);
      return ok(JSON.parse(raw));
    }
    if (p === "/admin/analysis" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const id = uid("a_");
      kvPut("analysis:" + id, JSON.stringify({ id, label: cleanStr(body.label, 80) || "Match analysis", report: body.report || {}, createdAt: Date.now() }));
      return ok({ ok: true, id });
    }

    /* ---- site logo + admin login ---- */
    if (p === "/site" && method === "GET") { const s = kvGet("site"); return ok(s ? JSON.parse(s) : {}); }
    if (p === "/admin/site" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const cur = JSON.parse(kvGet("site") || "{}");
      if (typeof body.logo === "string") cur.logo = body.logo;
      kvPut("site", JSON.stringify(cur)); return ok({ ok: true });
    }
    if (p === "/admin/login" && method === "POST") { return ok({ ok: isAdmin(adminHdr) }); }

    return err("not found", 404);
  }

  window.localBackend = { route };
})();
