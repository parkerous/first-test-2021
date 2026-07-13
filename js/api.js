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
