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

/* ---- rank movement (▲/▼ vs the previous day) ----
   Snapshots the day's ranks and compares to the previous day so teams that
   climbed show a green up-arrow and teams that fell show a red down-arrow. */
function computeMovement(fullRows) {
  const cur = {};
  fullRows.forEach((t, i) => { cur[t.name] = i + 1; });
  const day = preseasonDay();
  let snap = null;
  try { snap = JSON.parse(localStorage.getItem("soai_rank_snap") || "null"); } catch (e) { }
  if (!snap || typeof snap.curDay !== "number") {
    snap = { curDay: day, curRanks: cur, prevRanks: {} };            // first ever: no baseline yet
  } else if (snap.curDay < day) {
    snap = { curDay: day, prevRanks: snap.curRanks || {}, curRanks: cur };  // new day: yesterday's ranks become the baseline
  } else {
    snap.curRanks = cur;                                             // same day: refresh, keep the baseline
  }
  const prev = snap.prevRanks || {};
  try { localStorage.setItem("soai_rank_snap", JSON.stringify(snap)); } catch (e) { }
  const mv = {};
  fullRows.forEach(t => { if (prev[t.name] != null) mv[t.name] = prev[t.name] - cur[t.name]; });  // + = moved up
  return mv;
}
function moveArrow(m) {
  if (m == null || m === 0) return "";
  const n = Math.abs(m);
  return m > 0
    ? `<span class="mv up" title="Up ${n}">▲${n > 1 ? n : ""}</span>`
    : `<span class="mv down" title="Down ${n}">▼${n > 1 ? n : ""}</span>`;
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
  const mv = computeMovement(rows);

  body.innerHTML = rows.map((t, i) => `
    <tr>
      <td class="rk">${i + 1}</td>
      <td><span class="team">${crest(t.name)}${scrimEsc(t.name)}${t.played > 0 ? moveArrow(mv[t.name]) : ""}</span></td>
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
  const full = computeScrimStandings(data.teams, data.matches);
  const played = full.filter(t => t.played > 0);
  if (!played.length) { host.style.display = "none"; return; }
  const mv = computeMovement(full);
  // team logos: preseason-pool logo, else a same-named registered team's logo
  const regLogo = {};
  try { const teams = await apiGet("/teams"); (teams || []).forEach(t => { if (t && t.name && t.logo) regLogo[t.name] = t.logo; }); } catch (e) { /* optional */ }
  const logoBy = {};
  (data.teams || []).forEach(t => { if (t && t.name) logoBy[t.name] = t.logo || regLogo[t.name] || ""; });
  const top = played.slice(0, 3);
  const leader = top[0];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = new Date();
  const dateStr = months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  const fmt = v => v > 0 ? "+" + v : "" + v;
  const medal = ["🥇", "🥈", "🥉"];
  // each top-3 team shows its logo when available, else the medal
  const crest = (name, i) => logoBy[name]
    ? `<img class="psl-logo" src="${scrimEsc(logoBy[name])}" alt="" />`
    : `<span class="psl-medal">${medal[i]}</span>`;
  host.innerHTML = `
    <div class="psl-head">
      <span class="psl-eyebrow">🏆 Top 3 · Day ${preseasonDay()}</span>
      <span class="psl-date">${dateStr}</span>
    </div>
    <div class="psl-leader">
      ${logoBy[leader.name] ? `<img class="psl-lead-logo" src="${scrimEsc(logoBy[leader.name])}" alt="" />` : `<span class="psl-crown">👑</span>`}
      <div><b>${scrimEsc(leader.name)}</b> is leading the preseason
        <span class="psl-sub">${leader.mw}–${leader.ml} · ${fmt(leader.record)} pts${leader.diff != null ? ` · ${fmt(leader.diff)} diff` : ""}</span>
      </div>
    </div>
    <div class="psl-top3">
      ${top.map((t, i) => `<div class="psl-item"><span class="psl-rank">${i + 1}</span>${crest(t.name, i)}<span class="psl-name">${scrimEsc(t.name)}${moveArrow(mv[t.name])}</span><span class="psl-pts">${fmt(t.record)} pts</span></div>`).join("")}
    </div>
    <a class="psl-link" href="standings.html">Full standings →</a>`;
}

/* ---- homepage "Latest Matches" widget (#psMatches) ----
   Shows the last GAMES_SHOWN games (most recent first) with a "Day N" counter
   and a per-game day tag. Edit the constants below to change the start day. */
const PRESEASON_START = "2026-07-28";   // Day 1 of the preseason (today = Day 2)
const GAMES_SHOWN = 5;                  // how many recent games to show on the homepage

/* Preseason day number for a given time (default: now). */
function preseasonDay(ms) {
  const startMs = new Date(PRESEASON_START + "T00:00:00").getTime();
  const base = (ms != null) ? new Date(ms) : new Date();
  const dMs = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime();
  return Math.floor((dMs - startMs) / 86400000) + 1;
}
/* Which day a match was played: explicit m.day, else from a real timestamp,
   else the seed backfill (first batch = Day 1, later batch = Day 2). */
function matchDay(m) {
  if (typeof m.day === "number") return m.day;
  if (typeof m.createdAt === "number" && m.createdAt > 1e11) return preseasonDay(m.createdAt);
  return (typeof m.createdAt === "number" && m.createdAt > 12) ? 2 : 1;
}

async function renderLatestMatches() {
  const host = document.getElementById("psMatches");
  if (!host) return;
  const day = preseasonDay();
  let data = { teams: [], matches: [] };
  try { data = await apiGet("/scrims"); } catch (e) { /* leave empty */ }
  const ms = (data.matches || [])
    .slice()
    .sort((a, b) => matchDay(b) - matchDay(a) || (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, GAMES_SHOWN);
  if (!ms.length) { host.style.display = "none"; return; }
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = new Date();
  const dateStr = months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  host.innerHTML = `
    <div class="psl-head">
      <span class="psl-eyebrow">🏐 Latest Matches · Day ${day}</span>
      <span class="psl-date">Last ${GAMES_SHOWN} games · ${dateStr}</span>
    </div>
    <div class="psm-list">
      ${ms.map(m => `<div class="psm-row"><span class="psm-day">Day ${matchDay(m)}</span>${scrimMatchLine(m).text}</div>`).join("")}
    </div>
    <a class="psl-link" href="standings.html">All results &amp; standings →</a>`;
}

document.addEventListener("DOMContentLoaded", function () { renderScrimStandings(); renderPreseasonLeaders(); renderLatestMatches(); });
