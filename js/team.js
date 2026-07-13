/* ============================================================
   Soai — single team page: shows a team's jerseys front & back
   ============================================================ */
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

async function init() {
  const el = document.getElementById("teamDetail");
  const id = new URLSearchParams(location.search).get("id");
  if (!apiConfigured()) { el.innerHTML = `<p class="empty">Connect the league backend to view team pages.</p>`; return; }
  if (!id) { el.innerHTML = `<p class="empty">No team specified.</p>`; return; }
  try {
    const t = await apiGet("/team?id=" + encodeURIComponent(id));
    if (!t || t.error) { el.innerHTML = `<p class="empty">Team not found (or not approved yet).</p>`; return; }
    document.title = t.name + " — Soai";
    el.innerHTML = `
      <div class="card">
        <div class="team-head-lg">
          <img class="team-logo" style="width:88px;height:88px" src="${esc(t.logo || "img/mikasa.svg")}" alt="" />
          <div>
            <div class="nm" style="font-size:26px;font-weight:900">${esc(t.name)}</div>
            <span class="pending-pill">${esc(t.category || "League")}</span>
          </div>
        </div>
        <h3 style="margin:18px 0 10px;color:var(--gold)">Jersey</h3>
        <div class="jerseys jerseys-big">
          <figure><img src="${esc(t.jerseyFront || "img/mikasa.svg")}" alt="jersey front" /><figcaption>Front</figcaption></figure>
          <figure><img src="${esc(t.jerseyBack || "img/mikasa.svg")}" alt="jersey back" /><figcaption>Back</figcaption></figure>
        </div>
      </div>`;
  } catch (e) { el.innerHTML = `<p class="empty">Couldn't load this team (${esc(e.message)}).</p>`; }
}
document.addEventListener("DOMContentLoaded", init);
