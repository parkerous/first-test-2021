/* ============================================================
   Soai — Free Agent Board: LFT (looking for team) / LFP (looking
   for players) posts. Open to post; the admin can moderate.
   ============================================================ */
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

let POSTS = [];
let postType = "LFT";
let filter = "all";

function discordHtml(d) {
  return /^https?:\/\//i.test(d) ? `<a href="${esc(d)}" target="_blank" rel="noopener">${esc(d)}</a>` : esc(d);
}
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60); if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24); return d + "d ago";
}

function render() {
  const grid = document.getElementById("boardGrid");
  const list = POSTS.filter(p => filter === "all" || p.type === filter);
  if (!list.length) { grid.innerHTML = `<p class="empty">No ${filter === "all" ? "" : filter + " "}listings yet — be the first to post!</p>`; return; }
  grid.innerHTML = list.map(p => `
    <div class="fa-card ${p.type}">
      <div class="fa-top">
        <span class="fa-tag ${p.type}">${p.type === "LFP" ? "📣 LFP" : "🙋 LFT"}</span>
        ${p.role ? `<span class="pending-pill">${esc(p.role)}</span>` : ""}
        <span class="fa-when">${timeAgo(p.createdAt)}</span>
      </div>
      <div class="fa-name">${esc(p.name)}</div>
      <p class="fa-msg">${esc(p.msg)}</p>
      <div class="fa-contact">💬 ${discordHtml(p.discord)}</div>
    </div>`).join("");
}

async function load() {
  const grid = document.getElementById("boardGrid");
  if (!apiConfigured()) { document.getElementById("cfgNotice").style.display = "block"; grid.innerHTML = `<p class="empty">The board will appear once the backend is connected.</p>`; return; }
  try {
    POSTS = await apiGet("/board");
    render();
  } catch (e) { grid.innerHTML = `<p class="empty">Couldn't load the board (${esc(e.message)}).</p>`; }
}

async function post() {
  const m = document.getElementById("postMsg");
  if (!apiConfigured()) { m.textContent = "⚠️ The board isn't connected yet."; return; }
  const name = document.getElementById("fName").value.trim();
  const role = document.getElementById("fRole").value;
  const discord = document.getElementById("fDiscord").value.trim();
  const msg = document.getElementById("fMsg").value.trim();
  if (!name || !discord || !msg) { m.textContent = "Fill in your name, a contact, and a message."; return; }
  m.textContent = "Posting…";
  try {
    const res = await apiPost("/board", { type: postType, name, role, discord, msg });
    if (res && res.ok) {
      m.textContent = "✅ Posted!";
      ["fName", "fDiscord", "fMsg"].forEach(id => document.getElementById(id).value = "");
      document.getElementById("fRole").value = "";
      await load();
    } else { m.textContent = "⚠️ " + ((res && res.error) || "Couldn't post."); }
  } catch (e) { m.textContent = "⚠️ " + e.message; }
}

function init() {
  // fill role options
  const sel = document.getElementById("fRole");
  (typeof PLAYER_ROLES !== "undefined" ? PLAYER_ROLES : []).forEach(r => {
    const o = document.createElement("option"); o.value = r; o.textContent = r; sel.appendChild(o);
  });
  // type toggle
  document.querySelectorAll("#typeSeg button").forEach(b => b.addEventListener("click", () => {
    postType = b.dataset.type;
    document.querySelectorAll("#typeSeg button").forEach(x => x.classList.toggle("on", x === b));
    document.getElementById("fName").placeholder = postType === "LFP" ? "Team name" : "Your name / handle";
  }));
  // filter
  document.querySelectorAll("#filterSeg button").forEach(b => b.addEventListener("click", () => {
    filter = b.dataset.filter;
    document.querySelectorAll("#filterSeg button").forEach(x => x.classList.toggle("on", x === b));
    render();
  }));
  document.getElementById("postBtn").addEventListener("click", post);
  load();
}
document.addEventListener("DOMContentLoaded", init);
