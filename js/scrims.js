/* ============================================================
   Soai — Preseason scrim standings.
   Reads { teams, matches } from the backend (/scrims) and computes,
   per team: match record (win +1 / loss −1), set win-rate, and point
   differential. Shared by the public standings page and the admin panel.

   Match model: { id, teamA, teamB, sets: [ {a,b} | {w:"A"|"B"} ], createdAt }
   - {a,b}  = a set with point scores (counts toward point differential)
   - {w}    = a set with a known winner but no recorded points
   ============================================================ */

function scrimEsc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
/* team pool entries may be plain names (legacy) or {name, logo}. */
function scrimTeamName(t) { return typeof t === "string" ? t : ((t && t.name) || ""); }

/* Build the standings table from the team list + match list. */
function computeScrimStandings(teams, matches) {
  const table = {};
  const base = name => ({ name, mw: 0, ml: 0, sw: 0, sl: 0, pf: 0, pa: 0, pointed: false });
  (teams || []).forEach(t => { const n = scrimTeamName(t); if (n) table[n] = base(n); });
  const ensure = n => (table[n] || (table[n] = base(n)));

  (matches || []).forEach(m => {
    if (!m || !m.teamA || !m.teamB) return;
    const A = ensure(m.teamA), B = ensure(m.teamB);
    let aSets = 0, bSets = 0;
    (m.sets || []).forEach(s => {
      const hasPts = typeof s.a === "number" && typeof s.b === "number";
      let aWon;
      if (hasPts) {
        aWon = s.a >= s.b;
        A.pf += s.a; A.pa += s.b; B.pf += s.b; B.pa += s.a;
        A.pointed = B.pointed = true;
      } else if (s.w === "A" || s.w === "B") {
        aWon = s.w === "A";
      } else return;
      if (aWon) { aSets++; A.sw++; B.sl++; } else { bSets++; B.sw++; A.sl++; }
    });
    if (aSets === 0 && bSets === 0) return;      // no scored sets → not a played match
    if (aSets > bSets) { A.mw++; B.ml++; } else if (bSets > aSets) { B.mw++; A.ml++; }
  });

  return Object.values(table).map(t => {
    const setsPlayed = t.sw + t.sl;
    t.played = t.mw + t.ml;
    t.record = t.mw - t.ml;                        // win +1 / loss −1
    t.setsPlayed = setsPlayed;
    t.setWinrate = setsPlayed ? t.sw / setsPlayed : null;
    t.diff = t.pointed ? (t.pf - t.pa) : null;    // null → no point scores recorded
    return t;
  }).sort((a, b) =>
    b.record - a.record ||                                    // Pts: win +1 / loss −1
    ((b.played > 0 ? 1 : 0) - (a.played > 0 ? 1 : 0)) ||      // teams that have played rank above teams with no games
    ((b.diff || 0) - (a.diff || 0)) ||                        // point differential
    ((b.setWinrate || 0) - (a.setWinrate || 0)) ||            // set win-rate
    a.name.localeCompare(b.name)
  );
}

/* "Green Giants  2–0  Nekopara  (25–23, 25–15)" for a match. */
function scrimMatchLine(m) {
  let a = 0, b = 0;
  const scores = [];
  (m.sets || []).forEach(s => {
    const hasPts = typeof s.a === "number" && typeof s.b === "number";
    let aWon = hasPts ? s.a >= s.b : s.w === "A";
    if (aWon) a++; else b++;
    if (hasPts) scores.push(`${s.a}–${s.b}`);
  });
  const winA = a >= b;
  return {
    winner: winA ? m.teamA : m.teamB,
    text: `<b>${scrimEsc(m.teamA)}</b> <span class="ps-score">${a}–${b}</span> <b>${scrimEsc(m.teamB)}</b>`
      + (scores.length ? ` <span class="ps-sets">(${scores.join(", ")})</span>` : ` <span class="ps-sets">(scores n/a)</span>`),
  };
}

/* ---- public standings page (#scrimBody / #scrimResults) ---- */
async function renderScrimStandings() {
  const body = document.getElementById("scrimBody");
  if (!body) return;
  let data = { teams: [], matches: [] };
  try { data = await apiGet("/scrims"); } catch (e) { /* leave empty */ }
  const rows = computeScrimStandings(data.teams, data.matches);
  // logo per team: use the preseason-pool logo, else fall back to the logo of a
  // team with the same name already registered on the Teams page.
  const regLogo = {};
  try { const teams = await apiGet("/teams"); (teams || []).forEach(t => { if (t && t.name && t.logo) regLogo[t.name] = t.logo; }); } catch (e) { /* optional */ }
  const logoBy = {};
  (data.teams || []).forEach(t => { if (t && t.name) logoBy[t.name] = t.logo || regLogo[t.name] || ""; });
  rows.forEach(t => { if (!logoBy[t.name]) logoBy[t.name] = regLogo[t.name] || ""; });
  const pct = v => v == null ? "—" : Math.round(v * 100) + "%";
  const diff = v => v == null ? "—" : (v > 0 ? "+" + v : "" + v);
  const rec = v => (v > 0 ? "+" + v : "" + v);
  const recCls = v => v > 0 ? "ps-pos" : v < 0 ? "ps-neg" : "ps-zero";
  const crest = name => logoBy[name]
    ? `<img class="ps-logo" src="${scrimEsc(logoBy[name])}" alt="" />`
    : `<span class="dot"></span>`;

  body.innerHTML = rows.map((t, i) => `
    <tr>
      <td class="rk">${i + 1}</td>
      <td><span class="team">${crest(t.name)}${scrimEsc(t.name)}</span></td>
      <td class="num">${t.mw}</td>
      <td class="num">${t.ml}</td>
      <td class="num"><span class="ps-rec ${recCls(t.record)}">${rec(t.record)}</span></td>
      <td class="num">${t.setsPlayed ? `${t.sw}–${t.sl}` : "—"}</td>
      <td class="num">${pct(t.setWinrate)}</td>
      <td class="num">${diff(t.diff)}</td>
    </tr>`).join("");

  // recent results list under the table
  const rl = document.getElementById("scrimResults");
  if (rl) {
    const ms = (data.matches || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    rl.innerHTML = ms.length
      ? ms.map(m => `<div class="ps-result">🏐 ${scrimMatchLine(m).text}</div>`).join("")
      : `<p class="empty">No scrim results posted yet.</p>`;
  }
}

/* ---- homepage "Preseason Leaders" widget (#psLeaders) ----
   Recomputed live on every visit and stamped with today's date, so it always
   shows the current leader + top 3 with no manual updating. */
async function renderPreseasonLeaders() {
  const host = document.getElementById("psLeaders");
  if (!host) return;
  let data = { teams: [], matches: [] };
  try { data = await apiGet("/scrims"); } catch (e) { /* leave empty */ }
  const played = computeScrimStandings(data.teams, data.matches).filter(t => t.played > 0);
  if (!played.length) { host.style.display = "none"; return; }
  const top = played.slice(0, 3);
  const leader = top[0];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = new Date();
  const dateStr = months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  const fmt = v => v > 0 ? "+" + v : "" + v;
  const medal = ["🥇", "🥈", "🥉"];
  host.innerHTML = `
    <div class="psl-head">
      <span class="psl-eyebrow">🏆 Preseason Leaders</span>
      <span class="psl-date">Updated daily · ${dateStr}</span>
    </div>
    <div class="psl-leader">
      <span class="psl-crown">👑</span>
      <div><b>${scrimEsc(leader.name)}</b> is leading the preseason
        <span class="psl-sub">${leader.mw}–${leader.ml} · ${fmt(leader.record)} pts${leader.diff != null ? ` · ${fmt(leader.diff)} diff` : ""}</span>
      </div>
    </div>
    <div class="psl-top3">
      ${top.map((t, i) => `<div class="psl-item"><span class="psl-medal">${medal[i]}</span><span class="psl-name">${scrimEsc(t.name)}</span><span class="psl-pts">${fmt(t.record)} pts</span></div>`).join("")}
    </div>
    <a class="psl-link" href="standings.html">Full standings →</a>`;
}

document.addEventListener("DOMContentLoaded", function () { renderScrimStandings(); renderPreseasonLeaders(); });
