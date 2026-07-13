/* ============================================================
   Soai — Coaching: a featured video that auto-plays as you scroll
   to it, coaches grouped by position (admin-managed), and a form to
   request coaching from the site.
   ============================================================ */
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }

let COACHES = [];

/* ---------- featured video: auto-play (muted) when scrolled into view ---------- */
let ytPlayer = null, ytReady = false;
function loadYouTube() {
  if (window.YT && window.YT.Player) { onYouTubeIframeAPIReady(); return; }
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
}
window.onYouTubeIframeAPIReady = function () {
  ytPlayer = new YT.Player("featVideo", {
    videoId: "FTRQBqpXYy4",
    playerVars: { mute: 1, playsinline: 1, rel: 0, modestbranding: 1 },
    events: { onReady: function () { ytReady = true; watchVideoScroll(); } },
  });
};
function watchVideoScroll() {
  const el = document.querySelector(".feature-video");
  if (!el || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!ytReady || !ytPlayer.playVideo) return;
      if (e.isIntersecting && e.intersectionRatio >= 0.5) ytPlayer.playVideo();
      else ytPlayer.pauseVideo();
    });
  }, { threshold: [0, 0.5, 1] });
  io.observe(el);
}

/* ---------- coaches collection (big banner tiles, 3 in a row) ---------- */
function coachTile(c) {
  const initial = (c.name[0] || "?").toUpperCase();
  const bannerImg = c.banner || c.photo;
  const banner = bannerImg
    ? `<img src="${esc(bannerImg)}" alt="" />`
    : `<span class="ct-ph">${esc(initial)}</span>`;
  const dc = c.discord
    ? (/^https?:\/\//i.test(c.discord)
        ? `<a class="btn ghost ct-dc" href="${esc(c.discord)}" target="_blank" rel="noopener">💬 Message on Discord</a>`
        : `<span class="ct-dc chip">💬 ${esc(c.discord)}</span>`)
    : "";
  return `
    <div class="coach-tile">
      <div class="ct-banner">${banner}${c.pos ? `<span class="ct-pos">${esc(c.pos)}</span>` : ""}</div>
      <div class="ct-body">
        <div class="ct-name">${esc(c.name)}</div>
        ${c.blurb ? `<p class="ct-blurb">${esc(c.blurb)}</p>` : ""}
        ${dc}
      </div>
    </div>`;
}
function renderCoaches() {
  const host = document.getElementById("coachCollection");
  if (!COACHES.length) { host.innerHTML = `<p class="empty">No coaches added yet — check back soon, or send a request below.</p>`; return; }
  host.innerHTML = COACHES.map(coachTile).join("");
}
async function loadCoaches() {
  const host = document.getElementById("coachCollection");
  if (!apiConfigured()) { host.innerHTML = `<p class="empty">Coaches will appear once the backend is connected.</p>`; return; }
  try { COACHES = await apiGet("/coaches"); renderCoaches(); }
  catch (e) { host.innerHTML = `<p class="empty">Couldn't load coaches (${esc(e.message)}).</p>`; }
}

/* ---------- request coaching ---------- */
async function sendRequest() {
  const m = document.getElementById("rqMsgOut");
  if (!apiConfigured()) { m.textContent = "⚠️ Coaching isn't connected yet."; return; }
  const name = val("rqName"), msg = val("rqMsg");
  if (!name || !msg) { m.textContent = "Enter your name and what you want to work on."; return; }
  m.textContent = "Sending…";
  try {
    const r = await apiPost("/coaching/request", { name, roblox: val("rqRoblox"), pos: document.getElementById("rqPos").value, coach: val("rqCoach"), msg });
    if (r && r.ok) {
      m.textContent = "✅ Request sent — a coach will reach out!";
      ["rqName", "rqRoblox", "rqCoach", "rqMsg"].forEach(id => document.getElementById(id).value = "");
      document.getElementById("rqPos").value = "";
    } else { m.textContent = "⚠️ " + ((r && r.error) || "Couldn't send."); }
  } catch (e) { m.textContent = "⚠️ " + e.message; }
}

function init() {
  const sel = document.getElementById("rqPos");
  (typeof PLAYER_ROLES !== "undefined" ? PLAYER_ROLES : []).forEach(r => {
    const o = document.createElement("option"); o.value = r; o.textContent = r; sel.appendChild(o);
  });
  document.getElementById("rqBtn").addEventListener("click", sendRequest);
  loadCoaches();
  loadYouTube();
}
document.addEventListener("DOMContentLoaded", init);
