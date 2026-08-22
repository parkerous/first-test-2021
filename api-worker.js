/* ============================================================
   Soai — combined Worker: serves the static site AND the backend API.
   Static files are served automatically by Cloudflare Assets; this
   script only handles the API routes below.

   Bindings (see wrangler.toml): KV namespace SOAI.
   Admin password: ADMIN_KEY secret if set, else the default below.
   ============================================================ */

const DEFAULT_ADMIN_KEY = "64928";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function isAdmin(req, env) {
  const k = req.headers.get("X-Admin-Key");
  const expected = (env && env.ADMIN_KEY) || DEFAULT_ADMIN_KEY;
  return !!(k && k === expected);
}
const ROLES = ["Setter", "Outside Hitter", "Middle Blocker", "Opposite", "Libero", "All Rounder", "Sub"];
function cleanPlayers(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(p => {
    if (typeof p === "string") return { name: p.trim().slice(0, 40), photo: "", role: "" };
    if (p && typeof p === "object") {
      return {
        name: String(p.name == null ? "" : p.name).trim().slice(0, 40),
        photo: typeof p.photo === "string" ? p.photo : "",
        role: ROLES.includes(p.role) ? p.role : "",
      };
    }
    return null;
  }).filter(p => p && p.name).slice(0, 30);
}
function cleanStr(s, n) { return String(s == null ? "" : s).trim().slice(0, n); }
/* preseason scrims: seed data + set-score sanitiser */
/* Season 2 team list (the 13 teams from the official preseason final records) */
const DEFAULT_S2_TEAMS = ["Vanguard", "The Order", "Invictus", "Equinox", "Miku", "Volare", "Umino", "Stinger", "Teiko", "Orchid", "Kittyoo", "Seishin Skyblade", "Valencia Spike"];
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
/* build a roster-change log from the old vs new player lists */
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
function cleanTitles(arr) { if (!Array.isArray(arr)) return []; return arr.map(s => cleanStr(s, 30)).filter(Boolean).slice(0, 6); }
function publicCoach(c) {
  return { id: c.id, name: c.name, pos: c.pos || "", discord: c.discord || "", blurb: c.blurb || "", photo: c.photo || "", banner: c.banner || "", createdAt: c.createdAt };
}
function publicProfile(pr) {
  return {
    id: pr.id, name: pr.name, roblox: pr.roblox || "", pos: pr.pos || "", bio: pr.bio || "",
    photo: pr.photo || "", titles: Array.isArray(pr.titles) ? pr.titles : [], verified: !!pr.verified,
    tagline: pr.tagline || "", createdAt: pr.createdAt,
  };
}
function publicTeam(t) {
  return {
    id: t.id, name: t.name, status: t.status, category: t.category || "League",
    logo: t.logo, banner: t.banner || "", captain: t.captain || "", discord: t.discord || "",
    jerseyFront: t.jerseyFront, jerseyBack: t.jerseyBack,
    players: Array.isArray(t.players) ? t.players : [],
    log: Array.isArray(t.log) ? t.log.slice(-30).reverse() : [],
    createdAt: t.createdAt,
  };
}

/* API routes — return a Response, or null to let a static asset serve it */
async function handleApi(req, env, url) {
  const p = url.pathname.replace(/\/+$/, "") || "/";
  const KV = env.SOAI;

  if (p === "/announcements" && req.method === "GET") {
    const a = await KV.get("announcements");
    return json(a ? JSON.parse(a) : []);
  }
  if (p === "/admin/announcements" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const body = await req.json();
    await KV.put("announcements", JSON.stringify(Array.isArray(body.announcements) ? body.announcements : []));
    return json({ ok: true });
  }
  if (p === "/teams/register" && req.method === "POST") {
    const b = await req.json();
    if (!b.name || !b.password) return json({ error: "name and password are required" }, 400);
    const id = "t_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const team = {
      id, name: String(b.name).slice(0, 60), status: "pending",
      category: b.category === "Binsu" ? "Binsu" : "League",
      logo: b.logo || "", banner: b.banner || "",
      captain: cleanStr(b.captain, 40), discord: cleanStr(b.discord, 40),
      jerseyFront: b.jerseyFront || "", jerseyBack: b.jerseyBack || "",
      players: cleanPlayers(b.players), log: [],
      passHash: await sha256(b.password), createdAt: Date.now(),
    };
    await KV.put("team:" + id, JSON.stringify(team));
    return json({ ok: true, id });
  }
  if (p === "/teams" && req.method === "GET") {
    const cat = url.searchParams.get("category");
    const list = await KV.list({ prefix: "team:" });
    const out = [];
    for (const k of list.keys) {
      const t = JSON.parse(await KV.get(k.name));
      if (t.status !== "approved") continue;
      if (cat && (t.category || "League") !== cat) continue;
      out.push(publicTeam(t));
    }
    return json(out);
  }
  if (p === "/team" && req.method === "GET") {
    const raw = await KV.get("team:" + url.searchParams.get("id"));
    if (!raw) return json({ error: "not found" }, 404);
    const t = JSON.parse(raw);
    if (t.status !== "approved") return json({ error: "not found" }, 404);
    return json(publicTeam(t));
  }
  if (p === "/admin/teams" && req.method === "GET") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const list = await KV.list({ prefix: "team:" });
    const out = [];
    for (const k of list.keys) out.push(publicTeam(JSON.parse(await KV.get(k.name))));
    out.sort((a, b) => a.createdAt - b.createdAt);
    return json(out);
  }
  if (p === "/admin/teams/approve" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const { id } = await req.json();
    const raw = await KV.get("team:" + id);
    if (!raw) return json({ error: "not found" }, 404);
    const t = JSON.parse(raw); t.status = "approved";
    await KV.put("team:" + id, JSON.stringify(t));
    return json({ ok: true });
  }
  if (p === "/admin/teams/reject" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const { id } = await req.json();
    await KV.delete("team:" + id);
    return json({ ok: true });
  }
  if (p === "/admin/teams/category" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const { id, category } = await req.json();
    const raw = await KV.get("team:" + id);
    if (!raw) return json({ error: "not found" }, 404);
    const t = JSON.parse(raw); t.category = category === "Binsu" ? "Binsu" : "League";
    await KV.put("team:" + id, JSON.stringify(t));
    return json({ ok: true });
  }
  /* a team edits its own roster using its team password */
  if (p === "/team/roster" && req.method === "POST") {
    const { id, password, players } = await req.json();
    const raw = await KV.get("team:" + id);
    if (!raw) return json({ error: "not found" }, 404);
    const t = JSON.parse(raw);
    if (t.passHash !== await sha256(password || "")) return json({ error: "wrong team password" }, 403);
    const changes = diffPlayers(t.players, players);
    t.players = cleanPlayers(players);
    appendLog(t, changes);
    await KV.put("team:" + id, JSON.stringify(t));
    return json({ ok: true, players: t.players });
  }
  /* a team edits its own info (captain, discord, banner) with its password */
  if (p === "/team/info" && req.method === "POST") {
    const { id, password, captain, discord, banner } = await req.json();
    const raw = await KV.get("team:" + id);
    if (!raw) return json({ error: "not found" }, 404);
    const t = JSON.parse(raw);
    if (t.passHash !== await sha256(password || "")) return json({ error: "wrong team password" }, 403);
    if (typeof captain === "string") { const v = cleanStr(captain, 40); if (v !== (t.captain || "")) appendLog(t, [`👑 Captain set to ${v || "—"}`]); t.captain = v; }
    if (typeof discord === "string") t.discord = cleanStr(discord, 40);
    if (typeof banner === "string" && banner) t.banner = banner;
    await KV.put("team:" + id, JSON.stringify(t));
    return json({ ok: true, team: publicTeam(t) });
  }
  /* the admin can edit any team's roster */
  if (p === "/admin/teams/roster" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const { id, players } = await req.json();
    const raw = await KV.get("team:" + id);
    if (!raw) return json({ error: "not found" }, 404);
    const t = JSON.parse(raw);
    const changes = diffPlayers(t.players, players);
    t.players = cleanPlayers(players);
    appendLog(t, changes);
    await KV.put("team:" + id, JSON.stringify(t));
    return json({ ok: true });
  }
  /* the admin can edit a team's name, category, logo, banner, captain, discord, jerseys */
  if (p === "/admin/teams/update" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const raw = await KV.get("team:" + b.id);
    if (!raw) return json({ error: "not found" }, 404);
    const t = JSON.parse(raw);
    if (typeof b.name === "string" && b.name.trim()) t.name = b.name.trim().slice(0, 60);
    if (b.category) t.category = b.category === "Binsu" ? "Binsu" : "League";
    if (typeof b.logo === "string" && b.logo) t.logo = b.logo;
    if (typeof b.banner === "string" && b.banner) t.banner = b.banner;
    if (typeof b.captain === "string") { const v = cleanStr(b.captain, 40); if (v !== (t.captain || "")) appendLog(t, [`👑 Captain set to ${v || "—"}`]); t.captain = v; }
    if (typeof b.discord === "string") t.discord = cleanStr(b.discord, 40);
    if (typeof b.jerseyFront === "string" && b.jerseyFront) t.jerseyFront = b.jerseyFront;
    if (typeof b.jerseyBack === "string" && b.jerseyBack) t.jerseyBack = b.jerseyBack;
    await KV.put("team:" + b.id, JSON.stringify(t));
    return json({ ok: true });
  }
  /* ---- Player profiles ---- */
  if (p === "/profiles" && req.method === "GET") {
    const list = await KV.list({ prefix: "profile:" });
    const out = [];
    for (const k of list.keys) out.push(publicProfile(JSON.parse(await KV.get(k.name))));
    out.sort((a, b) => (b.verified - a.verified) || (a.createdAt - b.createdAt));
    return json(out);
  }
  if (p === "/profile" && req.method === "GET") {
    const raw = await KV.get("profile:" + url.searchParams.get("id"));
    if (!raw) return json({ error: "not found" }, 404);
    return json(publicProfile(JSON.parse(raw)));
  }
  if (p === "/profiles/create" && req.method === "POST") {
    const b = await req.json();
    const name = cleanStr(b.name, 40);
    if (!name || !b.password) return json({ error: "name and password are required" }, 400);
    const id = "u_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const pr = {
      id, name, roblox: cleanStr(b.roblox, 40), pos: ROLES.includes(b.pos) ? b.pos : "",
      bio: cleanStr(b.bio, 200), photo: b.photo || "", titles: [], verified: false, tagline: "",
      passHash: await sha256(b.password), createdAt: Date.now(),
    };
    await KV.put("profile:" + id, JSON.stringify(pr));
    return json({ ok: true, id });
  }
  if (p === "/profile/update" && req.method === "POST") {
    const b = await req.json();
    const raw = await KV.get("profile:" + b.id);
    if (!raw) return json({ error: "not found" }, 404);
    const pr = JSON.parse(raw);
    if (pr.passHash !== await sha256(b.password || "")) return json({ error: "wrong password" }, 403);
    if (typeof b.name === "string" && b.name.trim()) pr.name = cleanStr(b.name, 40);
    if (typeof b.roblox === "string") pr.roblox = cleanStr(b.roblox, 40);
    if (b.pos !== undefined) pr.pos = ROLES.includes(b.pos) ? b.pos : "";
    if (typeof b.bio === "string") pr.bio = cleanStr(b.bio, 200);
    if (typeof b.photo === "string" && b.photo) pr.photo = b.photo;
    await KV.put("profile:" + b.id, JSON.stringify(pr));
    return json({ ok: true, profile: publicProfile(pr) });
  }
  if (p === "/admin/profiles/titles" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const raw = await KV.get("profile:" + b.id);
    if (!raw) return json({ error: "not found" }, 404);
    const pr = JSON.parse(raw);
    pr.titles = cleanTitles(b.titles);
    if (typeof b.verified === "boolean") pr.verified = b.verified;
    if (typeof b.tagline === "string") pr.tagline = cleanStr(b.tagline, 60);
    await KV.put("profile:" + b.id, JSON.stringify(pr));
    return json({ ok: true });
  }
  if (p === "/admin/profiles/delete" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const { id } = await req.json();
    await KV.delete("profile:" + id);
    return json({ ok: true });
  }

  /* ---- Coaching: admin-managed coaches + coaching requests ---- */
  if (p === "/coaches" && req.method === "GET") {
    const list = await KV.list({ prefix: "coach:" });
    const out = [];
    for (const k of list.keys) out.push(publicCoach(JSON.parse(await KV.get(k.name))));
    out.sort((a, b) => a.createdAt - b.createdAt);
    return json(out);
  }
  if (p === "/admin/coaches/add" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const name = cleanStr(b.name, 40);
    if (!name) return json({ error: "name is required" }, 400);
    const id = "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const c = { id, name, pos: ROLES.includes(b.pos) ? b.pos : "", discord: cleanStr(b.discord, 60), blurb: cleanStr(b.blurb, 200), photo: b.photo || "", banner: b.banner || "", createdAt: Date.now() };
    await KV.put("coach:" + id, JSON.stringify(c));
    return json({ ok: true, id });
  }
  if (p === "/admin/coaches/delete" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const { id } = await req.json();
    await KV.delete("coach:" + id);
    return json({ ok: true });
  }
  if (p === "/coaching/request" && req.method === "POST") {
    const b = await req.json();
    const name = cleanStr(b.name, 40), msg = cleanStr(b.msg, 280);
    if (!name || !msg) return json({ error: "name and message are required" }, 400);
    const raw = await KV.get("coachreqs");
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({ id: "r_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, roblox: cleanStr(b.roblox, 40), pos: ROLES.includes(b.pos) ? b.pos : "", coach: cleanStr(b.coach, 40), msg, createdAt: Date.now() });
    if (list.length > 200) list.length = 200;
    await KV.put("coachreqs", JSON.stringify(list));
    return json({ ok: true });
  }
  if (p === "/admin/coaching/requests" && req.method === "GET") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const raw = await KV.get("coachreqs");
    return json(raw ? JSON.parse(raw) : []);
  }
  if (p === "/admin/coaching/requests/delete" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const { id } = await req.json();
    const raw = await KV.get("coachreqs");
    const list = (raw ? JSON.parse(raw) : []).filter(x => x.id !== id);
    await KV.put("coachreqs", JSON.stringify(list));
    return json({ ok: true });
  }
  /* ---- League rules: official text (admin) + community suggestions ---- */
  if (p === "/rules" && req.method === "GET") {
    const t = await KV.get("rules");
    return json({ text: t || "" });
  }
  if (p === "/admin/rules" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    await KV.put("rules", String(b.text == null ? "" : b.text).slice(0, 20000));
    return json({ ok: true });
  }
  if (p === "/rules/suggest" && req.method === "POST") {
    const b = await req.json();
    const text = cleanStr(b.text, 500);
    if (!text) return json({ error: "a rule suggestion is required" }, 400);
    const raw = await KV.get("rulesuggest");
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({ id: "rs_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: cleanStr(b.name, 40), text, createdAt: Date.now() });
    if (list.length > 200) list.length = 200;
    await KV.put("rulesuggest", JSON.stringify(list));
    return json({ ok: true });
  }
  if (p === "/admin/rules/suggestions" && req.method === "GET") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const raw = await KV.get("rulesuggest");
    return json(raw ? JSON.parse(raw) : []);
  }
  if (p === "/admin/rules/suggestions/delete" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const { id } = await req.json();
    const raw = await KV.get("rulesuggest");
    const list = (raw ? JSON.parse(raw) : []).filter(x => x.id !== id);
    await KV.put("rulesuggest", JSON.stringify(list));
    return json({ ok: true });
  }

  /* ---- Match analysis ingest (from the Colab notebook) + read ---- */
  if (p === "/analyses" && req.method === "GET") {
    const list = await KV.list({ prefix: "analysis:" });
    const out = [];
    for (const k of list.keys) { const a = JSON.parse(await KV.get(k.name)); out.push({ id: a.id, label: a.label, createdAt: a.createdAt }); }
    out.sort((a, b) => b.createdAt - a.createdAt);
    return json(out);
  }
  if (p === "/analysis" && req.method === "GET") {
    const raw = await KV.get("analysis:" + url.searchParams.get("id"));
    if (!raw) return json({ error: "not found" }, 404);
    return json(JSON.parse(raw));
  }
  if (p === "/admin/analysis" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const id = "a_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const a = { id, label: cleanStr(b.label, 80) || "Match analysis", report: b.report || {}, createdAt: Date.now() };
    await KV.put("analysis:" + id, JSON.stringify(a));
    return json({ ok: true, id });
  }
  if (p === "/learn" && req.method === "POST") {
    const b = await req.json();
    const raw = await KV.get("learn");
    const agg = raw ? JSON.parse(raw) : { actions: {}, results: {}, videos: 0, touches: 0 };
    if (b.newVideo) agg.videos += 1;
    for (const ev of (b.events || [])) {
      if (!ev || !ev.action) continue;
      agg.touches += 1;
      agg.actions[ev.action] = (agg.actions[ev.action] || 0) + 1;
      if (ev.result) { const key = ev.action + ":" + ev.result; agg.results[key] = (agg.results[key] || 0) + 1; }
    }
    await KV.put("learn", JSON.stringify(agg));
    return json({ ok: true });
  }
  if (p === "/learn/insights" && req.method === "GET") {
    const raw = await KV.get("learn");
    return json(raw ? JSON.parse(raw) : { actions: {}, results: {}, videos: 0, touches: 0 });
  }
  /* ---- Preseason scrims: standings source (public read, admin write) ---- */
  if (p === "/scrims" && req.method === "GET") {
    let teams;
    const tRaw = await KV.get("scrimteams");
    if (tRaw == null) { teams = DEFAULT_SCRIM_TEAMS.map(n => ({ name: n, logo: "" })); await KV.put("scrimteams", JSON.stringify(teams)); }
    else teams = normScrimTeams(JSON.parse(tRaw));
    let mRaw = await KV.get("scrims");
    if (mRaw == null) { mRaw = JSON.stringify(DEFAULT_SCRIMS); await KV.put("scrims", mRaw); }
    return json({ teams, matches: JSON.parse(mRaw) });
  }
  if (p === "/admin/scrims/teams" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    await KV.put("scrimteams", JSON.stringify(normScrimTeams(b.teams)));
    return json({ ok: true });
  }
  if (p === "/admin/scrims/add" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const teamA = cleanStr(b.teamA, 40), teamB = cleanStr(b.teamB, 40);
    const sets = cleanSets(b.sets);
    if (!teamA || !teamB) return json({ error: "both teams are required" }, 400);
    if (teamA === teamB) return json({ error: "a team can't scrim itself" }, 400);
    if (!sets.length) return json({ error: "at least one set score is required" }, 400);
    const raw = await KV.get("scrims");
    const list = raw ? JSON.parse(raw) : DEFAULT_SCRIMS.slice();
    list.push({ id: "s_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), teamA, teamB, sets, createdAt: Date.now() });
    await KV.put("scrims", JSON.stringify(list));
    return json({ ok: true });
  }
  if (p === "/admin/scrims/delete" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const { id } = await req.json();
    const raw = await KV.get("scrims");
    const list = (raw ? JSON.parse(raw) : DEFAULT_SCRIMS.slice()).filter(x => x.id !== id);
    await KV.put("scrims", JSON.stringify(list));
    return json({ ok: true });
  }
  if (p === "/admin/scrims/reset" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    // reset the games, but KEEP any team logos already uploaded
    const existing = normScrimTeams(JSON.parse((await KV.get("scrimteams")) || "[]"));
    const logoByName = {}; existing.forEach(t => { if (t.logo) logoByName[t.name] = t.logo; });
    const teams = DEFAULT_SCRIM_TEAMS.map(n => ({ name: n, logo: logoByName[n] || "" }));
    existing.forEach(t => { if (!DEFAULT_SCRIM_TEAMS.includes(t.name)) teams.push(t); });
    await KV.put("scrimteams", JSON.stringify(teams));
    await KV.put("scrims", JSON.stringify(DEFAULT_SCRIMS));
    return json({ ok: true });
  }

  /* ---- Season 2: fixtures, results, playoff bracket ---- */
  if (p === "/s2" && req.method === "GET") {
    const raw = await KV.get("s2");
    if (raw == null) { const d = { teams: DEFAULT_S2_TEAMS.slice(), fixtures: [] }; await KV.put("s2", JSON.stringify(d)); return json(d); }
    return json(JSON.parse(raw));
  }
  if (p === "/admin/s2/teams" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const cur = JSON.parse((await KV.get("s2")) || `{"teams":[],"fixtures":[]}`);
    cur.teams = (Array.isArray(b.teams) ? b.teams : []).map(n => cleanStr(n, 40)).filter(Boolean).slice(0, 40);
    await KV.put("s2", JSON.stringify(cur)); return json({ ok: true });
  }
  if (p === "/admin/s2/fixture/add" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const teamA = cleanStr(b.teamA, 40), teamB = cleanStr(b.teamB, 40);
    if (!teamA || !teamB) return json({ error: "both teams are required" }, 400);
    if (teamA === teamB) return json({ error: "a team can't play itself" }, 400);
    const stage = ["regular", "qf", "sf", "3rd", "f"].includes(b.stage) ? b.stage : "regular";
    const cur = JSON.parse((await KV.get("s2")) || `{"teams":[],"fixtures":[]}`);
    const id = "f_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    cur.fixtures.push({ id, teamA, teamB, stage, when: typeof b.when === "number" ? b.when : 0, sets: null, createdAt: Date.now() });
    await KV.put("s2", JSON.stringify(cur)); return json({ ok: true });
  }
  if (p === "/admin/s2/fixture/delete" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const cur = JSON.parse((await KV.get("s2")) || `{"teams":[],"fixtures":[]}`);
    cur.fixtures = cur.fixtures.filter(f => f.id !== b.id);
    await KV.put("s2", JSON.stringify(cur)); return json({ ok: true });
  }
  if (p === "/admin/s2/result" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const cur = JSON.parse((await KV.get("s2")) || `{"teams":[],"fixtures":[]}`);
    const fx = cur.fixtures.find(f => f.id === b.id);
    if (!fx) return json({ error: "fixture not found" }, 404);
    const sets = cleanSets(b.sets);
    fx.sets = sets.length ? sets : null;   // empty → clear the result
    await KV.put("s2", JSON.stringify(cur)); return json({ ok: true });
  }

  /* ---- pick'em: fan predictions per fixture ---- */
  if (p === "/pickem" && req.method === "GET") {
    const raw = await KV.get("pickem"); const map = raw ? JSON.parse(raw) : {};
    const out = {};
    Object.keys(map).forEach(fid => { out[fid] = { A: map[fid].A || 0, B: map[fid].B || 0 }; });
    return json(out);
  }
  if (p === "/pickem/vote" && req.method === "POST") {
    const b = await req.json();
    const fid = cleanStr(b.fixtureId, 40), pick = b.pick === "A" ? "A" : b.pick === "B" ? "B" : "";
    const voter = cleanStr(b.voter, 60);
    if (!fid || !pick || !voter) return json({ error: "fixtureId, pick and voter are required" }, 400);
    const raw = await KV.get("pickem"); const map = raw ? JSON.parse(raw) : {};
    const e = map[fid] || (map[fid] = { A: 0, B: 0, voters: {} });
    const prev = e.voters[voter];
    if (prev !== pick) {
      if (prev) e[prev] = Math.max(0, (e[prev] || 0) - 1);
      e[pick] = (e[pick] || 0) + 1;
      e.voters[voter] = pick;
      await KV.put("pickem", JSON.stringify(map));
    }
    return json({ ok: true });
  }

  if (p === "/site" && req.method === "GET") {
    const s = await KV.get("site");
    return json(s ? JSON.parse(s) : {});
  }
  if (p === "/admin/site" && req.method === "POST") {
    if (!isAdmin(req, env)) return json({ error: "unauthorized" }, 401);
    const b = await req.json();
    const cur = JSON.parse((await KV.get("site")) || "{}");
    if (typeof b.logo === "string") cur.logo = b.logo;
    if (typeof b.statSheet === "string") cur.statSheet = b.statSheet.trim().slice(0, 500);
    await KV.put("site", JSON.stringify(cur));
    return json({ ok: true });
  }
  if (p === "/admin/login" && req.method === "POST") {
    return json({ ok: isAdmin(req, env) });
  }
  return null;   // not an API route → let a static asset handle it
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    try {
      const res = await handleApi(req, env, url);
      if (res) return res;
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500);
    }
    // fall through to static assets (index.html, css, js, images, …)
    if (env.ASSETS) return env.ASSETS.fetch(req);
    return json({ error: "not found" }, 404);
  },
};
