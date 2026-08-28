/* ============================================================
   Soai API client.

   The site talks to a backend in this priority order:
     1. an explicit URL saved as `soai_api_override` (admin → "connect a
        shared backend"), else
     2. the SAME ORIGIN — when the site is served by the combined Cloudflare
        Worker (api-worker.js), the API lives at the same origin and every
        visitor shares one KV store, else
     3. a built-in backend that runs right in the browser (bottom of this
        file), so the site still works with NO server (e.g. on Netlify or
        opened as a local file).

   Whenever a remote attempt fails (static host with no API, Worker down),
   we fall back to the in-browser backend so the site never shows
   "Load failed".
   ============================================================ */

const SOAI_API = "";   // no hard-coded remote; discovered at runtime (see above)

/* Old builds hard-coded a Cloudflare Worker URL and saved it as an override.
   That Worker is gone, so a leftover copy in a visitor's browser would keep
   the site pointed at a dead host. Drop those known-dead values on load. */
(function clearDeadOverride() {
  try {
    const dead = ["first-test-2021.binsustar.workers.dev", "first-test-2021.workers.dev"];
    const cur = localStorage.getItem("soai_api_override") || "";
    if (dead.some(d => cur.indexOf(d) !== -1)) localStorage.removeItem("soai_api_override");
  } catch (e) { /* ignore */ }
})();

function overrideBase() { return (localStorage.getItem("soai_api_override") || SOAI_API || "").replace(/\/+$/, ""); }
function sameOriginBase() { return (location.protocol === "http:" || location.protocol === "https:") ? location.origin.replace(/\/+$/, "") : ""; }
/* Best-guess base for callers that build URLs directly. */
function apiBase() { return overrideBase() || sameOriginBase(); }
/* The site always has a working backend (remote if reachable, else in-browser). */
function apiConfigured() { return true; }
function adminKey() { return sessionStorage.getItem("soai_admin_key") || ""; }

async function fetchJson(base, path, method, body, adminHdr) {
  const headers = {};
  if (method === "POST") headers["Content-Type"] = "application/json";
  if (adminHdr) headers["X-Admin-Key"] = adminHdr;
  const opts = { method, headers };
  if (method === "POST") opts.body = JSON.stringify(body || {});
  const r = await fetch(base + path, opts);
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();   // throws if the response isn't JSON (e.g. a static host's HTML)
}

async function localCall(path, method, body, adminHdr) {
  const res = await window.localBackend.route(path, method, method === "POST" ? (body || {}) : null, adminHdr || "");
  if (res.status >= 400 && method === "GET") throw new Error("HTTP " + res.status);
  return res.data;
}

/* One shared probe (memoized) decides whether the same origin hosts the API,
   so a static host logs at most a single failed request instead of one per call. */
let _originProbe = null;
function originHasApi() {
  if (_originProbe) return _originProbe;
  const origin = sameOriginBase();
  _originProbe = (async () => {
    if (!origin) return false;
    try { await fetchJson(origin, "/site", "GET", null, ""); return true; }
    catch (e) { return false; }
  })();
  return _originProbe;
}

/* Route one request through override → same-origin Worker → in-browser. */
async function request(path, method, body, adminHdr) {
  const override = overrideBase();
  if (override) {
    try { return await fetchJson(override, path, method, body, adminHdr); }
    catch (e) { return localCall(path, method, body, adminHdr); }
  }
  const origin = sameOriginBase();
  if (origin && await originHasApi()) {
    try { return await fetchJson(origin, path, method, body, adminHdr); }
    catch (e) { return localCall(path, method, body, adminHdr); }
  }
  return localCall(path, method, body, adminHdr);
}

async function rawGet(path, adminHdr) { return request(path, "GET", null, adminHdr || ""); }
async function apiGet(path) { return request(path, "GET", null, ""); }
async function apiPost(path, body, admin) { return request(path, "POST", body || {}, admin ? adminKey() : ""); }

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

  // Preseason scrims — seeded on first access (17 teams + posted results).
  /* Season 2 registered players (from the team-registration forum) — the
     seed roster for the admin-managed player stats. */
  const DEFAULT_PLAYERS = [
    { id: "p_001", name: "NewAccountZX194", team: "Miku", pos: "Libero" },
    { id: "p_002", name: "PowerHext", team: "Miku", pos: "Middle" },
    { id: "p_003", name: "4Quantum_Mechanic", team: "Miku", pos: "Outside/Setter" },
    { id: "p_004", name: "adeeblox", team: "Miku", pos: "Opposite" },
    { id: "p_005", name: "kiwiikaleb", team: "Miku", pos: "Middle/Setter" },
    { id: "p_006", name: "gileshong1", team: "Miku", pos: "Outside/Opposite" },
    { id: "p_007", name: "Minir2k", team: "Miku", pos: "All-Rounder", cap: true },
    { id: "p_008", name: "TeemoABC", team: "Miku", pos: "All-Rounder" },
    { id: "p_009", name: "EVOSgar150848", team: "Miku", pos: "Outside" },
    { id: "p_010", name: "YoshiroKoiske", team: "Miku", pos: "Opposite/Middle" },
    { id: "p_011", name: "Bloop906", team: "Miku", pos: "Opposite/Middle" },
    { id: "p_012", name: "BlockBusta5", team: "Miku", pos: "Libero" },
    { id: "p_013", name: "Trixiine_glitcher", team: "Miku", pos: "Setter" },
    { id: "p_014", name: "codyjay_5", team: "Miku", pos: "Outside/Opposite" },
    { id: "p_015", name: "seanbahopo", team: "Miku", pos: "Outside" },
    { id: "p_016", name: "Razu", team: "Miku", pos: "Middle" },
    { id: "p_017", name: "Darkenesuo", team: "Yakamoz", pos: "Middle", cap: true },
    { id: "p_018", name: "lodsan1122", team: "Yakamoz", pos: "Outside" },
    { id: "p_019", name: "wojnwfjn", team: "Yakamoz", pos: "Setter" },
    { id: "p_020", name: "pawpaWAOS", team: "Yakamoz", pos: "Outside" },
    { id: "p_021", name: "DeadPhysic", team: "Yakamoz", pos: "Opposite" },
    { id: "p_022", name: "ItsGrof", team: "Yakamoz", pos: "Middle" },
    { id: "p_023", name: "TheDOtheSO", team: "Yakamoz", pos: "All-Rounder" },
    { id: "p_024", name: "Dee7055", team: "Yakamoz", pos: "All-Rounder" },
    { id: "p_025", name: "Mirto", team: "Stinger", pos: "All-Rounder", cap: true },
    { id: "p_026", name: "Vazelin", team: "Stinger", pos: "Outside" },
    { id: "p_027", name: "Sloth", team: "Stinger", pos: "All-Rounder" },
    { id: "p_028", name: "Kukuruzni", team: "Stinger", pos: "Middle" },
    { id: "p_029", name: "Forget", team: "Stinger", pos: "Outside" },
    { id: "p_030", name: "AMX", team: "Stinger", pos: "Opposite" },
    { id: "p_031", name: "Nomo", team: "Stinger", pos: "All-Rounder" },
    { id: "p_032", name: "Special", team: "Stinger", pos: "Opposite" },
    { id: "p_033", name: "Oblachko", team: "Stinger", pos: "Opposite" },
    { id: "p_034", name: "hiori", team: "Stinger", pos: "Setter" },
    { id: "p_035", name: "s0nr4ku", team: "Sendai Crows", pos: "Outside", cap: true },
    { id: "p_036", name: "delta_kendo", team: "Sendai Crows", pos: "Middle" },
    { id: "p_037", name: "TFX310", team: "Sendai Crows", pos: "Opposite" },
    { id: "p_038", name: "kyle292800", team: "Sendai Crows", pos: "All-Rounder" },
    { id: "p_039", name: "WanderWithAmi", team: "Sendai Crows", pos: "Setter" },
    { id: "p_040", name: "mec5md", team: "Sendai Crows", pos: "Outside/Middle" },
    { id: "p_041", name: "danielpogiramos", team: "Sendai Crows", pos: "All-Rounder" },
    { id: "p_042", name: "loudaFAEKGAMER", team: "Sendai Crows", pos: "Middle" },
    { id: "p_043", name: "KrunchyA", team: "Sendai Crows", pos: "Outside" },
    { id: "p_044", name: "Quadriono", team: "Sendai Crows", pos: "Middle" },
    { id: "p_045", name: "LJAL1414", team: "Sendai Crows", pos: "Middle" },
    { id: "p_046", name: "buddysing466", team: "Sendai Crows", pos: "Outside/Opposite" },
    { id: "p_047", name: "iAspxctt", team: "Sendai Crows", pos: "Outside/Opposite" },
    { id: "p_048", name: "Takigawa24", team: "Umino", pos: "All-Rounder" },
    { id: "p_049", name: "ImYourBackpack", team: "Umino", pos: "Opposite/Outside", cap: true },
    { id: "p_050", name: "edanacain3", team: "Umino", pos: "Middle" },
    { id: "p_051", name: "UchihaJpmark", team: "Umino", pos: "Setter" },
    { id: "p_052", name: "memenoob345", team: "Umino", pos: "Outside" },
    { id: "p_053", name: "Beta_XY", team: "Umino", pos: "Middle/Outside" },
    { id: "p_054", name: "choi_miri0", team: "Umino", pos: "Libero" },
    { id: "p_055", name: "zxnqt6", team: "Umino", pos: "Outside" },
    { id: "p_056", name: "memaybe_hungry", team: "Umino", pos: "Outside" },
    { id: "p_057", name: "haaeung", team: "Umino", pos: "Opposite" },
    { id: "p_058", name: "ygolpogi", team: "Umino", pos: "Middle/Outside" },
    { id: "p_059", name: "Dazza6111", team: "Vanguard", pos: "Setter" },
    { id: "p_060", name: "xpr_orxprap", team: "Vanguard", pos: "Opposite" },
    { id: "p_061", name: "it0ylilk1ds", team: "Vanguard", pos: "Libero" },
    { id: "p_062", name: "Monkeybsj", team: "Vanguard", pos: "All-Rounder" },
    { id: "p_063", name: "Aryentei", team: "Vanguard", pos: "Outside" },
    { id: "p_064", name: "Vanity_io", team: "Vanguard", pos: "Outside", cap: true },
    { id: "p_065", name: "neonoppaein", team: "Vanguard", pos: "Opposite" },
    { id: "p_066", name: "Action_penguin20", team: "Vanguard", pos: "Libero" },
    { id: "p_067", name: "vexvex_skittles", team: "Vanguard", pos: "Outside" },
    { id: "p_068", name: "daremardulce", team: "Vanguard", pos: "Setter" },
    { id: "p_069", name: "CoasMeyd", team: "Vanguard", pos: "All-Rounder" },
    { id: "p_070", name: "GodEdgeLordz", team: "Vanguard", pos: "All-Rounder" },
    { id: "p_071", name: "Grahlx", team: "Vanguard", pos: "Middle" },
    { id: "p_072", name: "apoleonicAvy", team: "Vanguard", pos: "Outside" },
    { id: "p_073", name: "tarutane", team: "Vanguard", pos: "Middle" },
    { id: "p_074", name: "The_ToxicCreeper", team: "Vanguard", pos: "Middle" },
    { id: "p_075", name: "TTBPCCCA65437", team: "Seishin Skyblade", pos: "All-Rounder", cap: true },
    { id: "p_076", name: "thekillerreyven", team: "Seishin Skyblade", pos: "Setter" },
    { id: "p_077", name: "Green_Power0928", team: "Seishin Skyblade", pos: "Outside" },
    { id: "p_078", name: "hjfdfhudfvgfhj", team: "Seishin Skyblade", pos: "Outside" },
    { id: "p_079", name: "ybanez", team: "Seishin Skyblade", pos: "Libero" },
    { id: "p_080", name: "AvengersWanda", team: "Seishin Skyblade", pos: "Opposite/Setter" },
    { id: "p_081", name: "prestomentom", team: "Seishin Skyblade", pos: "Opposite/Setter" },
    { id: "p_082", name: "Phantom_Spark214", team: "Seishin Skyblade", pos: "Middle/Libero" },
    { id: "p_083", name: "fddhvffg", team: "Seishin Skyblade", pos: "Opposite" },
    { id: "p_084", name: "coolfire32134", team: "Seishin Skyblade", pos: "Setter/Opposite" },
    { id: "p_085", name: "Arsenalimuchgood", team: "Seishin Skyblade", pos: "Opposite" },
    { id: "p_086", name: "Yuuko_yuuji", team: "Seishin Skyblade", pos: "Middle/Libero" },
    { id: "p_087", name: "iker123tr", team: "Seishin Skyblade", pos: "Outside" },
    { id: "p_088", name: "fljjn1920", team: "Seishin Skyblade", pos: "Outside" },
    { id: "p_089", name: "periodoftimeandspace", team: "Seishin Skyblade", pos: "Libero" },
    { id: "p_090", name: "5h4r1ngan", team: "Orchid", pos: "Setter" },
    { id: "p_091", name: "Creeperbean10", team: "Orchid", pos: "Opposite" },
    { id: "p_092", name: "Yaretzi_2976", team: "Orchid", pos: "Middle" },
    { id: "p_093", name: "UOUUZ2", team: "Orchid", pos: "Outside/Middle" },
    { id: "p_094", name: "cvrmichxl", team: "Orchid", pos: "All-Rounder", cap: true },
    { id: "p_095", name: "bad_gorl532", team: "Orchid", pos: "Libero" },
    { id: "p_096", name: "71K14", team: "Orchid", pos: "Setter" },
    { id: "p_097", name: "Asunaa247", team: "Orchid", pos: "Setter/Outside" },
    { id: "p_098", name: "qwertfddddddd", team: "Orchid", pos: "Outside/Opposite" },
    { id: "p_099", name: "syntheno", team: "Orchid", pos: "Middle" },
    { id: "p_100", name: "justinbeab", team: "Orchid", pos: "Outside" },
    { id: "p_101", name: "6PotatoStash9", team: "Orchid", pos: "Outside" },
    { id: "p_102", name: "AkoLangToh08912", team: "Orchid", pos: "Outside/Opposite" },
    { id: "p_103", name: "Lazybirdzz", team: "Orchid", pos: "Outside/Middle" },
    { id: "p_104", name: "SirCoolGuy1015", team: "Orchid", pos: "All-Rounder" },
    { id: "p_105", name: "XxkenkanekixX123765", team: "Orchid", pos: "All-Rounder" },
    { id: "p_106", name: "Ke7Lz", team: "The Order", pos: "All-Rounder", cap: true },
    { id: "p_107", name: "Elemenstreem", team: "The Order", pos: "Outside" },
    { id: "p_108", name: "xxHaPpYxx40", team: "The Order", pos: "Outside" },
    { id: "p_109", name: "oneonlyy", team: "The Order", pos: "Middle" },
    { id: "p_110", name: "Zanogrid", team: "The Order", pos: "Libero/Setter" },
    { id: "p_111", name: "Notinnapropieta", team: "The Order", pos: "Opposite" },
    { id: "p_112", name: "rgnaltaccount", team: "The Order", pos: "Setter/Libero" },
    { id: "p_113", name: "Crzycyko", team: "The Order", pos: "Outside" },
    { id: "p_114", name: "wawxenbow", team: "The Order", pos: "Libero" },
    { id: "p_115", name: "jzxicy", team: "The Order", pos: "Opposite" },
    { id: "p_116", name: "Elite_Ranks", team: "The Order", pos: "Middle" },
    { id: "p_117", name: "reneealexander", team: "The Order", pos: "All-Rounder" },
    { id: "p_118", name: "Eggyheadnooby", team: "The Order", pos: "All-Rounder" },
    { id: "p_119", name: "howdits", team: "The Order", pos: "Libero" },
    { id: "p_120", name: "D4C_KQ", team: "Kittyoo", pos: "All-Rounder", cap: true },
    { id: "p_121", name: "SOUL_NIGHT10", team: "Kittyoo", pos: "Outside/Middle" },
    { id: "p_122", name: "GONGKAK", team: "Kittyoo", pos: "Opposite" },
    { id: "p_123", name: "marvellling", team: "Kittyoo", pos: "Outside" },
    { id: "p_124", name: "Ivanlooi25", team: "Kittyoo", pos: "Outside/Libero" },
    { id: "p_125", name: "Lilithxia2712", team: "Kittyoo", pos: "Outside" },
    { id: "p_126", name: "noob_oguriSucks", team: "Kittyoo", pos: "Opposite/Outside" },
    { id: "p_127", name: "ofjezjezs", team: "Kittyoo", pos: "Middle/Libero" },
    { id: "p_128", name: "Lordcalypso", team: "Kittyoo", pos: "Libero" },
    { id: "p_129", name: "despavitar", team: "Kittyoo", pos: "Setter" },
    { id: "p_130", name: "TheLejendsQueen", team: "Kittyoo", pos: "Outside" },
    { id: "p_131", name: "N4_47", team: "Kittyoo", pos: "Middle" },
    { id: "p_132", name: "jorace20", team: "Kittyoo", pos: "Outside/Setter" },
    { id: "p_133", name: "chaous1000", team: "Kittyoo", pos: "Opposite/Middle" },
    { id: "p_134", name: "iam_north69699", team: "Kittyoo", pos: "Middle" },
    { id: "p_135", name: "jo_odmardeni", team: "Kittyoo", pos: "Middle" },
    { id: "p_136", name: "LB_Tempted", team: "Teiko", pos: "Setter" },
    { id: "p_137", name: "zimon25", team: "Teiko", pos: "Middle" },
    { id: "p_138", name: "Choiixzn", team: "Teiko", pos: "Middle" },
    { id: "p_139", name: "RisingBlades", team: "Teiko", pos: "All-Rounder", cap: true },
    { id: "p_140", name: "rehaniv12", team: "Teiko", pos: "Outside" },
    { id: "p_141", name: "Ace_Ish1kawa", team: "Teiko", pos: "Opposite" },
    { id: "p_142", name: "DarkEclips_e", team: "Teiko", pos: "All-Rounder" },
    { id: "p_143", name: "AnkaaMGL0804", team: "Teiko", pos: "Outside" },
    { id: "p_144", name: "gwagwacattroll", team: "Teiko", pos: "Libero" },
    { id: "p_145", name: "TW_Jupiter", team: "Teiko", pos: "Outside" },
    { id: "p_146", name: "DominuzGrey", team: "Teiko", pos: "Setter" },
    { id: "p_147", name: "RoyaleMice6", team: "Equinox", pos: "Setter/All-Rounder", cap: true },
    { id: "p_148", name: "memenoob345", team: "Equinox", pos: "Outside/All-Rounder" },
    { id: "p_149", name: "sulhipip", team: "Equinox", pos: "Outside/Opposite" },
    { id: "p_150", name: "kouuuuuuw", team: "Equinox", pos: "Middle" },
    { id: "p_151", name: "KungKangg", team: "Equinox", pos: "Middle/Libero" },
    { id: "p_152", name: "Gelatinousious", team: "Equinox", pos: "Opposite/All-Rounder" },
    { id: "p_153", name: "GGgrazyGG", team: "Equinox", pos: "Libero/Middle" },
    { id: "p_154", name: "NABILGOTMELIKE", team: "Equinox", pos: "Setter/Libero" },
    { id: "p_155", name: "Pazzel", team: "Equinox", pos: "Outside/Setter" },
    { id: "p_156", name: "vex", team: "Equinox", pos: "Opposite/Middle" },
    { id: "p_157", name: "lwkeyfinn", team: "Equinox", pos: "Middle/Outside" },
    { id: "p_158", name: "DarkJackxx12", team: "Equinox", pos: "Opposite/Outside" },
    { id: "p_159", name: "tadatsuneshinkai", team: "Equinox", pos: "Opposite/Middle" },
    { id: "p_160", name: "kenderdragoonca74", team: "Equinox", pos: "Outside" },
    { id: "p_161", name: "llewor1234", team: "Equinox", pos: "Opposite/Middle" },
  ];
  const BLANK_STATS = { games: 0, kills: 0, aces: 0, blocks: 0, digs: 0, assists: 0 };
  function cleanPStats(s) {
    const out = {};
    for (const k in BLANK_STATS) { const v = +((s || {})[k]); out[k] = isFinite(v) && v >= 0 ? Math.round(v * 10) / 10 : 0; }
    return out;
  }
  function seedPlayers() { return DEFAULT_PLAYERS.map(p => ({ id: p.id, name: p.name, team: p.team, pos: p.pos, cap: !!p.cap, stats: { ...BLANK_STATS } })); }
  /* Season 2 team list — the 13 teams in the official group-stage draw */
  /* Official Season 2 group-stage plan: 13 teams, Group A of 7 / Group B of 6,
     single round robin, every match BO3, nights at 7pm/8pm GMT+8. `when` is an
     absolute epoch so every visitor sees their own local time. */
  const S2_GROUP_DRAW = { A: ["Equinox", "The Order", "Miku", "Stinger", "Seishin Skyblade", "Kittyoo", "Yakamoz"], B: ["Invictus", "Vanguard", "Sendai Crows", "Umino", "Teiko", "Orchid"] };
  const DEFAULT_S2_FIXTURES = [
    { id: "s2n01_19", teamA: "Equinox", teamB: "Kittyoo", stage: "regular", when: 1788001200000, sets: null, createdAt: 1 },
    { id: "s2n01_20", teamA: "Invictus", teamB: "Orchid", stage: "regular", when: 1788004800000, sets: null, createdAt: 2 },
    { id: "s2n02_19", teamA: "The Order", teamB: "Seishin Skyblade", stage: "regular", when: 1788087600000, sets: null, createdAt: 3 },
    { id: "s2n02_20", teamA: "Vanguard", teamB: "Teiko", stage: "regular", when: 1788091200000, sets: null, createdAt: 4 },
    { id: "s2n03_19", teamA: "Miku", teamB: "Stinger", stage: "regular", when: 1788174000000, sets: null, createdAt: 5 },
    { id: "s2n03_20", teamA: "Sendai Crows", teamB: "Umino", stage: "regular", when: 1788177600000, sets: null, createdAt: 6 },
    { id: "s2n04_19", teamA: "Equinox", teamB: "Seishin Skyblade", stage: "regular", when: 1788260400000, sets: null, createdAt: 7 },
    { id: "s2n04_20", teamA: "Invictus", teamB: "Teiko", stage: "regular", when: 1788264000000, sets: null, createdAt: 8 },
    { id: "s2n05_19", teamA: "Kittyoo", teamB: "Stinger", stage: "regular", when: 1788346800000, sets: null, createdAt: 9 },
    { id: "s2n05_20", teamA: "Orchid", teamB: "Umino", stage: "regular", when: 1788350400000, sets: null, createdAt: 10 },
    { id: "s2n06_19", teamA: "The Order", teamB: "Miku", stage: "regular", when: 1788433200000, sets: null, createdAt: 11 },
    { id: "s2n06_20", teamA: "Vanguard", teamB: "Sendai Crows", stage: "regular", when: 1788436800000, sets: null, createdAt: 12 },
    { id: "s2n07_19", teamA: "Equinox", teamB: "Stinger", stage: "regular", when: 1788519600000, sets: null, createdAt: 13 },
    { id: "s2n07_20", teamA: "Invictus", teamB: "Umino", stage: "regular", when: 1788523200000, sets: null, createdAt: 14 },
    { id: "s2n08_19", teamA: "Yakamoz", teamB: "The Order", stage: "regular", when: 1788606000000, sets: null, createdAt: 15 },
    { id: "s2n08_20", teamA: "Teiko", teamB: "Sendai Crows", stage: "regular", when: 1788609600000, sets: null, createdAt: 16 },
    { id: "s2n09_19", teamA: "Seishin Skyblade", teamB: "Miku", stage: "regular", when: 1788692400000, sets: null, createdAt: 17 },
    { id: "s2n09_20", teamA: "Orchid", teamB: "Vanguard", stage: "regular", when: 1788696000000, sets: null, createdAt: 18 },
    { id: "s2n10_19", teamA: "Kittyoo", teamB: "The Order", stage: "regular", when: 1788778800000, sets: null, createdAt: 19 },
    { id: "s2n10_20", teamA: "Yakamoz", teamB: "Stinger", stage: "regular", when: 1788782400000, sets: null, createdAt: 20 },
    { id: "s2n11_19", teamA: "Equinox", teamB: "Miku", stage: "regular", when: 1788865200000, sets: null, createdAt: 21 },
    { id: "s2n11_20", teamA: "Invictus", teamB: "Sendai Crows", stage: "regular", when: 1788868800000, sets: null, createdAt: 22 },
    { id: "s2n12_19", teamA: "Yakamoz", teamB: "Kittyoo", stage: "regular", when: 1788951600000, sets: null, createdAt: 23 },
    { id: "s2n12_20", teamA: "Umino", teamB: "Vanguard", stage: "regular", when: 1788955200000, sets: null, createdAt: 24 },
    { id: "s2n13_19", teamA: "Stinger", teamB: "The Order", stage: "regular", when: 1789038000000, sets: null, createdAt: 25 },
    { id: "s2n13_20", teamA: "Teiko", teamB: "Orchid", stage: "regular", when: 1789041600000, sets: null, createdAt: 26 },
    { id: "s2n14_19", teamA: "Yakamoz", teamB: "Miku", stage: "regular", when: 1789124400000, sets: null, createdAt: 27 },
    { id: "s2n14_20", teamA: "Seishin Skyblade", teamB: "Kittyoo", stage: "regular", when: 1789128000000, sets: null, createdAt: 28 },
    { id: "s2n15_19", teamA: "Equinox", teamB: "The Order", stage: "regular", when: 1789210800000, sets: null, createdAt: 29 },
    { id: "s2n15_20", teamA: "Invictus", teamB: "Vanguard", stage: "regular", when: 1789214400000, sets: null, createdAt: 30 },
    { id: "s2n16_19", teamA: "Yakamoz", teamB: "Seishin Skyblade", stage: "regular", when: 1789297200000, sets: null, createdAt: 31 },
    { id: "s2n16_20", teamA: "Sendai Crows", teamB: "Orchid", stage: "regular", when: 1789300800000, sets: null, createdAt: 32 },
    { id: "s2n17_19", teamA: "Miku", teamB: "Kittyoo", stage: "regular", when: 1789383600000, sets: null, createdAt: 33 },
    { id: "s2n17_20", teamA: "Umino", teamB: "Teiko", stage: "regular", when: 1789387200000, sets: null, createdAt: 34 },
    { id: "s2n18_19", teamA: "Stinger", teamB: "Seishin Skyblade", stage: "regular", when: 1789470000000, sets: null, createdAt: 35 },
    { id: "s2n18_20", teamA: "Yakamoz", teamB: "Equinox", stage: "regular", when: 1789473600000, sets: null, createdAt: 36 },
  ];
  const DEFAULT_S2_TEAMS = ["Vanguard", "The Order", "Equinox", "Miku", "Umino", "Stinger", "Teiko", "Orchid", "Kittyoo", "Seishin Skyblade", "Sendai Crows", "Yakamoz", "Invictus"];
  const DEFAULT_SCRIM_TEAMS = ["Green Giants", "Equinox", "Senzai", "Seishin Skyblade", "The Order", "Canopus", "Miku", "Vanguard", "Volare", "Teiko", "Zenith", "Nekopara", "Ground Zero", "Invictus", "Stinger", "Ho-Kago Kawaii Larps", "Yakamoz", "Kittyoo"];
  const DEFAULT_SCRIMS = [
    { id: "seed_gg_neko", teamA: "Green Giants", teamB: "Nekopara", sets: [{ a: 25, b: 23 }, { a: 25, b: 15 }], createdAt: 1 },
    { id: "seed_van_gg", teamA: "Vanguard", teamB: "Green Giants", sets: [{ a: 25, b: 21 }, { a: 25, b: 15 }], createdAt: 2 },
    { id: "seed_sen_gz", teamA: "Senzai", teamB: "Ground Zero", sets: [{ w: "A" }, { w: "A" }], createdAt: 3 },
    { id: "seed_van_hkk", teamA: "Vanguard", teamB: "Ho-Kago Kawaii Larps", sets: [{ a: 25, b: 19 }, { a: 25, b: 18 }], createdAt: 4 },
    { id: "seed_sen_sei", teamA: "Senzai", teamB: "Seishin Skyblade", sets: [{ a: 25, b: 16 }, { a: 25, b: 19 }], createdAt: 5 },
    { id: "seed_miku_neko", teamA: "Miku", teamB: "Nekopara", sets: [{ a: 14, b: 25 }, { a: 22, b: 25 }], createdAt: 6 },
    { id: "seed_inv_can", teamA: "Invictus", teamB: "Canopus", sets: [{ a: 25, b: 19 }, { a: 25, b: 20 }], createdAt: 7 },
    { id: "seed_sei_inv", teamA: "Seishin Skyblade", teamB: "Invictus", sets: [{ a: 12, b: 25 }, { a: 19, b: 25 }], createdAt: 8 },
    { id: "seed_inv_gz", teamA: "Invictus", teamB: "Ground Zero", sets: [{ w: "A" }, { w: "A" }], createdAt: 9 },
    { id: "seed_miku_eq", teamA: "Miku", teamB: "Equinox", sets: [{ a: 25, b: 23 }, { a: 16, b: 25 }, { a: 25, b: 23 }], createdAt: 10 },
    { id: "seed_kit_van", teamA: "Kittyoo", teamB: "Vanguard", sets: [{ w: "B" }, { w: "B" }], createdAt: 11 },
    { id: "seed_neko_van", teamA: "Nekopara", teamB: "Vanguard", sets: [{ a: 20, b: 25 }, { a: 11, b: 25 }], createdAt: 12 },
    { id: "seed_zen_van", teamA: "Zenith", teamB: "Vanguard", sets: [{ a: 13, b: 25 }, { a: 25, b: 23 }, { a: 19, b: 25 }], createdAt: 13 },
    { id: "seed_order_can", teamA: "The Order", teamB: "Canopus", sets: [{ w: "A" }, { w: "A" }], createdAt: 14 },
    { id: "seed_inv_van", teamA: "Invictus", teamB: "Vanguard", sets: [{ a: 25, b: 21 }, { a: 18, b: 25 }, { a: 18, b: 25 }], createdAt: 15 },
    { id: "seed_gg_can", teamA: "Green Giants", teamB: "Canopus", sets: [{ a: 25, b: 19 }, { a: 25, b: 17 }], createdAt: 16 },
    { id: "seed_inv_zen", teamA: "Invictus", teamB: "Zenith", sets: [{ a: 25, b: 17 }, { a: 25, b: 17 }], createdAt: 17 },
    { id: "seed_sen_kit", teamA: "Senzai", teamB: "Kittyoo", sets: [{ w: "A" }, { w: "A" }], createdAt: 18 },
    { id: "seed_order_eq", teamA: "The Order", teamB: "Equinox", sets: [{ a: 25, b: 15 }, { a: 26, b: 24 }], createdAt: 19 },
    { id: "seed_eq_sen", teamA: "Equinox", teamB: "Senzai", sets: [{ a: 25, b: 19 }, { a: 25, b: 23 }], createdAt: 20 },
    { id: "seed_order_van", teamA: "The Order", teamB: "Vanguard", sets: [{ a: 18, b: 25 }, { a: 25, b: 21 }, { a: 25, b: 22 }], createdAt: 21 },
    { id: "seed_gg_van_ff", teamA: "Green Giants", teamB: "Vanguard", sets: [{ w: "B" }, { w: "B" }], createdAt: 22 },
    { id: "seed_miku_inv", teamA: "Miku", teamB: "Invictus", sets: [{ a: 24, b: 26 }, { a: 13, b: 25 }], createdAt: 23 },
    { id: "seed_sti_gz", teamA: "Stinger", teamB: "Ground Zero", sets: [{ a: 25, b: 15 }, { a: 25, b: 19 }], createdAt: 24 },
    { id: "seed_gg_order_ff", teamA: "Green Giants", teamB: "The Order", sets: [{ w: "B" }, { w: "B" }], createdAt: 25 },
    { id: "seed_gg_kit_ff", teamA: "Green Giants", teamB: "Kittyoo", sets: [{ w: "B" }, { w: "B" }], createdAt: 26 },
    { id: "seed_sen_van", teamA: "Senzai", teamB: "Vanguard", sets: [{ a: 18, b: 25 }, { a: 27, b: 25 }, { a: 15, b: 25 }], createdAt: 27 },
    { id: "seed_gg_sti_ff", teamA: "Green Giants", teamB: "Stinger", sets: [{ w: "B" }, { w: "B" }], createdAt: 28 },
    { id: "seed_miku_eq2", teamA: "Miku", teamB: "Equinox", sets: [{ a: 18, b: 25 }, { a: 25, b: 20 }, { a: 21, b: 25 }], createdAt: 29 },
    { id: "seed_miku_sti", teamA: "Miku", teamB: "Stinger", sets: [{ a: 25, b: 18 }, { a: 25, b: 13 }], createdAt: 30 },
    { id: "seed_eq_inv", teamA: "Equinox", teamB: "Invictus", sets: [{ a: 25, b: 23 }, { a: 24, b: 26 }, { a: 25, b: 23 }], createdAt: 31, day: 3 },
    { id: "seed_zen_inv", teamA: "Zenith", teamB: "Invictus", sets: [{ a: 25, b: 19 }, { a: 21, b: 25 }, { a: 25, b: 21 }], createdAt: 32, day: 3 },
    { id: "seed_van_zen", teamA: "Vanguard", teamB: "Zenith", sets: [{ a: 25, b: 11 }, { a: 25, b: 4 }, { a: 25, b: 9 }], createdAt: 33, day: 3 },
    { id: "seed_inv_sen", teamA: "Invictus", teamB: "Senzai", sets: [{ a: 19, b: 25 }, { a: 25, b: 23 }, { a: 25, b: 22 }], createdAt: 34, day: 3 },
    { id: "seed_order_sen", teamA: "The Order", teamB: "Senzai", sets: [{ a: 25, b: 11 }, { a: 25, b: 19 }], createdAt: 35, day: 3 },
    { id: "seed_eq_sti", teamA: "Equinox", teamB: "Stinger", sets: [{ a: 25, b: 18 }, { a: 25, b: 8 }], createdAt: 36, day: 3 },
    { id: "seed_order_sti", teamA: "The Order", teamB: "Stinger", sets: [{ a: 25, b: 22 }, { a: 25, b: 11 }], createdAt: 37, day: 4 },
    { id: "seed_vol_gz_ff", teamA: "Volare", teamB: "Ground Zero", sets: [{ w: "A" }, { w: "A" }], createdAt: 38, day: 5 },
    { id: "seed_van_inv", teamA: "Vanguard", teamB: "Invictus", sets: [{ a: 25, b: 22 }, { a: 25, b: 22 }], createdAt: 39, day: 5 },
    { id: "seed_eq_inv2", teamA: "Equinox", teamB: "Invictus", sets: [{ a: 25, b: 7 }, { a: 32, b: 30 }], createdAt: 40, day: 5 },
    { id: "seed_inv_vol_ff", teamA: "Invictus", teamB: "Volare", sets: [{ w: "A" }, { w: "A" }], createdAt: 41, day: 6 },
    { id: "seed_sen_vol", teamA: "Senzai", teamB: "Volare", sets: [{ a: 25, b: 18 }, { a: 25, b: 17 }], createdAt: 42, day: 6 },
    { id: "seed_order_inv", teamA: "The Order", teamB: "Invictus", sets: [{ a: 25, b: 17 }, { a: 22, b: 25 }, { a: 25, b: 22 }], createdAt: 43, day: 6 },
    { id: "seed_van_eq", teamA: "Vanguard", teamB: "Equinox", sets: [{ a: 25, b: 21 }, { a: 25, b: 19 }], createdAt: 44, day: 6 },
    { id: "seed_van_zen_ff", teamA: "Vanguard", teamB: "Zenith", sets: [{ w: "A" }, { w: "A" }], createdAt: 45, day: 7 },
    { id: "seed_miku_inv2", teamA: "Miku", teamB: "Invictus", sets: [{ a: 23, b: 25 }, { a: 25, b: 21 }, { a: 25, b: 19 }], createdAt: 46, day: 7 },
    { id: "seed_miku_zen", teamA: "Miku", teamB: "Zenith", sets: [{ a: 27, b: 29 }, { a: 25, b: 12 }, { a: 25, b: 13 }], createdAt: 47, day: 7 },
    { id: "seed_miku_sen", teamA: "Miku", teamB: "Senzai", sets: [{ a: 25, b: 21 }, { a: 19, b: 25 }, { a: 25, b: 22 }], createdAt: 48, day: 7 },
  ];
  function cleanSets(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(s => {
      if (s && typeof s.a === "number" && typeof s.b === "number" && isFinite(s.a) && isFinite(s.b))
        return { a: Math.max(0, Math.round(s.a)), b: Math.max(0, Math.round(s.b)) };
      if (s && (s.w === "A" || s.w === "B")) return { w: s.w };
      return null;
    }).filter(Boolean).slice(0, 5);
  }
  /* team pool: accept plain names (legacy) or {name, logo} → [{name, logo}] */
  function normScrimTeams(arr) {
    return (Array.isArray(arr) ? arr : []).map(t => typeof t === "string"
      ? { name: cleanStr(t, 40), logo: "" }
      : { name: cleanStr(t && t.name, 40), logo: (t && typeof t.logo === "string") ? t.logo : "" }
    ).filter(t => t.name).slice(0, 100);
  }

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

    /* ---- preseason scrims (standings source) ---- */
    if (p === "/scrims" && method === "GET") {
      let teams;
      const tRaw = kvGet("scrimteams");
      if (tRaw == null) { teams = DEFAULT_SCRIM_TEAMS.map(n => ({ name: n, logo: "" })); kvPut("scrimteams", JSON.stringify(teams)); }
      else teams = normScrimTeams(JSON.parse(tRaw));
      let mRaw = kvGet("scrims");
      if (mRaw == null) { mRaw = JSON.stringify(DEFAULT_SCRIMS); kvPut("scrims", mRaw); }
      return ok({ teams, matches: JSON.parse(mRaw) });
    }
    if (p === "/admin/scrims/teams" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      kvPut("scrimteams", JSON.stringify(normScrimTeams(body.teams))); return ok({ ok: true });
    }
    if (p === "/admin/scrims/add" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const teamA = cleanStr(body.teamA, 40), teamB = cleanStr(body.teamB, 40);
      const sets = cleanSets(body.sets);
      if (!teamA || !teamB) return err("both teams are required", 400);
      if (teamA === teamB) return err("a team can't scrim itself", 400);
      if (!sets.length) return err("at least one set score is required", 400);
      const raw = kvGet("scrims"); const list = raw ? JSON.parse(raw) : DEFAULT_SCRIMS.slice();
      list.push({ id: uid("s_"), teamA, teamB, sets, createdAt: Date.now() });
      kvPut("scrims", JSON.stringify(list)); return ok({ ok: true });
    }
    if (p === "/admin/scrims/delete" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const raw = kvGet("scrims"); const list = (raw ? JSON.parse(raw) : DEFAULT_SCRIMS.slice()).filter(x => x.id !== body.id);
      kvPut("scrims", JSON.stringify(list)); return ok({ ok: true });
    }
    if (p === "/admin/scrims/reset" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      // reset the games, but KEEP any team logos already uploaded
      const existing = normScrimTeams(JSON.parse(kvGet("scrimteams") || "[]"));
      const logoByName = {}; existing.forEach(t => { if (t.logo) logoByName[t.name] = t.logo; });
      const teams = DEFAULT_SCRIM_TEAMS.map(n => ({ name: n, logo: logoByName[n] || "" }));
      existing.forEach(t => { if (!DEFAULT_SCRIM_TEAMS.includes(t.name)) teams.push(t); });
      kvPut("scrimteams", JSON.stringify(teams));
      kvPut("scrims", JSON.stringify(DEFAULT_SCRIMS));
      return ok({ ok: true });
    }

    /* ---- Season 2: fixtures, results, playoff bracket ---- */
    if (p === "/s2" && method === "GET") {
      const raw = kvGet("s2");
      if (raw == null) {
        const d = { teams: DEFAULT_S2_TEAMS.slice(), fixtures: DEFAULT_S2_FIXTURES.map(x => ({ ...x })) };
        kvPut("s2", JSON.stringify(d)); return ok({ ...d, groups: S2_GROUP_DRAW });
      }
      const d = JSON.parse(raw);
      // data stored before the official 13-team draw, with no fixtures built on it → adopt the draw
      if ((!d.fixtures || !d.fixtures.length) && Array.isArray(d.teams) && d.teams.indexOf("Invictus") === -1) {
        d.teams = DEFAULT_S2_TEAMS.slice();
        d.fixtures = DEFAULT_S2_FIXTURES.map(x => ({ ...x }));
        kvPut("s2", JSON.stringify(d));
      }
      return ok({ ...d, groups: S2_GROUP_DRAW });
    }
    if (p === "/admin/s2/teams" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const cur = JSON.parse(kvGet("s2") || `{"teams":[],"fixtures":[]}`);
      cur.teams = (Array.isArray(body.teams) ? body.teams : []).map(n => cleanStr(n, 40)).filter(Boolean).slice(0, 40);
      kvPut("s2", JSON.stringify(cur)); return ok({ ok: true });
    }
    if (p === "/admin/s2/fixture/add" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const teamA = cleanStr(body.teamA, 40), teamB = cleanStr(body.teamB, 40);
      if (!teamA || !teamB) return err("both teams are required", 400);
      if (teamA === teamB) return err("a team can't play itself", 400);
      const stage = ["regular", "qf", "sf", "3rd", "f"].includes(body.stage) ? body.stage : "regular";
      const cur = JSON.parse(kvGet("s2") || `{"teams":[],"fixtures":[]}`);
      cur.fixtures.push({ id: uid("f_"), teamA, teamB, stage, when: typeof body.when === "number" ? body.when : 0, sets: null, createdAt: Date.now() });
      kvPut("s2", JSON.stringify(cur)); return ok({ ok: true });
    }
    if (p === "/admin/s2/fixture/delete" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const cur = JSON.parse(kvGet("s2") || `{"teams":[],"fixtures":[]}`);
      cur.fixtures = cur.fixtures.filter(f => f.id !== body.id);
      kvPut("s2", JSON.stringify(cur)); return ok({ ok: true });
    }
    if (p === "/admin/s2/result" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const cur = JSON.parse(kvGet("s2") || `{"teams":[],"fixtures":[]}`);
      const fx = cur.fixtures.find(f => f.id === body.id);
      if (!fx) return err("fixture not found", 404);
      const sets = cleanSets(body.sets);
      fx.sets = sets.length ? sets : null;   // empty → clear the result
      kvPut("s2", JSON.stringify(cur)); return ok({ ok: true });
    }

    /* ---- player roster + stats (admin-managed) ---- */
    if (p === "/players" && method === "GET") {
      const raw = kvGet("players");
      if (raw == null) { const d = seedPlayers(); kvPut("players", JSON.stringify(d)); return ok(d); }
      const d = JSON.parse(raw);
      // lists stored before the captain flag existed: merge it in once
      if (Array.isArray(d) && !d.some(x => x && x.cap)) {
        const capBy = {}; DEFAULT_PLAYERS.forEach(x => { if (x.cap) capBy[x.team + "|" + x.name] = true; });
        d.forEach(x => { if (capBy[x.team + "|" + x.name]) x.cap = true; });
        kvPut("players", JSON.stringify(d));
      }
      return ok(d);
    }
    if (p === "/admin/players/add" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const name = cleanStr(body.name, 40), team = cleanStr(body.team, 40), pos2 = cleanStr(body.pos, 40);
      if (!name || !team) return err("name and team are required", 400);
      const raw = kvGet("players"); const list = raw ? JSON.parse(raw) : seedPlayers();
      list.push({ id: uid("p_"), name, team, pos: pos2, stats: cleanPStats(body.stats) });
      kvPut("players", JSON.stringify(list)); return ok({ ok: true });
    }
    if (p === "/admin/players/update" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const raw = kvGet("players"); const list = raw ? JSON.parse(raw) : seedPlayers();
      const pl = list.find(x => x.id === body.id);
      if (!pl) return err("player not found", 404);
      if (typeof body.name === "string" && body.name.trim()) pl.name = cleanStr(body.name, 40);
      if (typeof body.team === "string" && body.team.trim()) pl.team = cleanStr(body.team, 40);
      if (typeof body.pos === "string") pl.pos = cleanStr(body.pos, 40);
      if (body.stats) pl.stats = cleanPStats({ ...pl.stats, ...body.stats });
      kvPut("players", JSON.stringify(list)); return ok({ ok: true });
    }
    if (p === "/admin/players/delete" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const raw = kvGet("players"); const list = (raw ? JSON.parse(raw) : seedPlayers()).filter(x => x.id !== body.id);
      kvPut("players", JSON.stringify(list)); return ok({ ok: true });
    }
    if (p === "/admin/players/reset" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      kvPut("players", JSON.stringify(seedPlayers())); return ok({ ok: true });
    }

    /* ---- honors: tournament placements driving the all-time rankings ---- */
    if (p === "/honors" && method === "GET") {
      const raw = kvGet("honors"); return ok(raw ? JSON.parse(raw) : []);
    }
    if (p === "/admin/honors/add" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const team = cleanStr(body.team, 40), event = cleanStr(body.event, 80), season = cleanStr(body.season, 30);
      const place = [1, 2, 3].includes(+body.place) ? +body.place : 0;
      if (!team || !event || !place) return err("team, event and placement (1-3) are required", 400);
      const raw = kvGet("honors"); const list = raw ? JSON.parse(raw) : [];
      list.unshift({ id: uid("h_"), team, event, place, season, createdAt: Date.now() });
      kvPut("honors", JSON.stringify(list)); return ok({ ok: true });
    }
    if (p === "/admin/honors/delete" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const raw = kvGet("honors"); const list = (raw ? JSON.parse(raw) : []).filter(x => x.id !== body.id);
      kvPut("honors", JSON.stringify(list)); return ok({ ok: true });
    }

    /* ---- pick'em: fan predictions per fixture ---- */
    if (p === "/pickem" && method === "GET") {
      const raw = kvGet("pickem"); const map = raw ? JSON.parse(raw) : {};
      const out = {};
      Object.keys(map).forEach(fid => { out[fid] = { A: map[fid].A || 0, B: map[fid].B || 0 }; });
      return ok(out);
    }
    if (p === "/pickem/vote" && method === "POST") {
      const fid = cleanStr(body.fixtureId, 40), pick = body.pick === "A" ? "A" : body.pick === "B" ? "B" : "";
      const voter = cleanStr(body.voter, 60);
      if (!fid || !pick || !voter) return err("fixtureId, pick and voter are required", 400);
      const raw = kvGet("pickem"); const map = raw ? JSON.parse(raw) : {};
      const e = map[fid] || (map[fid] = { A: 0, B: 0, voters: {} });
      const prev = e.voters[voter];
      if (prev === pick) return ok({ ok: true });
      if (prev) e[prev] = Math.max(0, (e[prev] || 0) - 1);
      e[pick] = (e[pick] || 0) + 1;
      e.voters[voter] = pick;
      kvPut("pickem", JSON.stringify(map)); return ok({ ok: true });
    }

    /* ---- site logo + admin login ---- */
    if (p === "/site" && method === "GET") { const s = kvGet("site"); return ok(s ? JSON.parse(s) : {}); }
    if (p === "/admin/site" && method === "POST") {
      if (!isAdmin(adminHdr)) return err("unauthorized", 401);
      const cur = JSON.parse(kvGet("site") || "{}");
      if (typeof body.logo === "string") cur.logo = body.logo;
      if (typeof body.statSheet === "string") cur.statSheet = body.statSheet.trim().slice(0, 500);
      kvPut("site", JSON.stringify(cur)); return ok({ ok: true });
    }
    if (p === "/admin/login" && method === "POST") { return ok({ ok: isAdmin(adminHdr) }); }

    return err("not found", 404);
  }

  window.localBackend = { route };
})();
