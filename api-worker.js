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
function publicTeam(t) {
  return { id: t.id, name: t.name, status: t.status, category: t.category || "League", logo: t.logo, jerseyFront: t.jerseyFront, jerseyBack: t.jerseyBack, createdAt: t.createdAt };
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
      logo: b.logo || "", jerseyFront: b.jerseyFront || "", jerseyBack: b.jerseyBack || "",
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
