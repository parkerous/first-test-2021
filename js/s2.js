/* ============================================================
   Soai — Season 2: fixtures, results, live standings and the
   playoff bracket. Data comes from the backend (/s2); admins manage
   fixtures in the admin panel (Season 2 tab). Fixture model:
   { id, teamA, teamB, stage: "regular"|"qf"|"sf"|"3rd"|"f",
     when: ms epoch (0 = TBA), sets: [{a,b}|{w}] | null }
   A fixture with sets is a played match — the same match model the
   scrim standings use, so standings reuse computeScrimStandings.
   ============================================================ */

const S2_STAGES = { regular: "Regular season", qf: "Quarterfinals", sf: "Semifinals", "3rd": "3rd place match", f: "Grand Final" };

function s2Played(f) { return !!(f && Array.isArray(f.sets) && f.sets.length); }
function s2Winner(f) {
  if (!s2Played(f)) return null;
  let a = 0, b = 0;
  f.sets.forEach(s => {
    const hasPts = typeof s.a === "number" && typeof s.b === "number";
    const aWon = hasPts ? s.a >= s.b : s.w === "A";
    if (aWon) a++; else b++;
  });
  return a > b ? f.teamA : b > a ? f.teamB : null;
}
function s2When(f) {
  if (!f.when) return "Date TBA";
  const d = new Date(f.when);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hm = d.getHours() || d.getMinutes() ? " · " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") : "";
  return months[d.getMonth()] + " " + d.getDate() + hm;
}

/* One schedule row: names, time, result (or VS). */
function s2RowHtml(f) {
  if (s2Played(f)) {
    return `<div class="ps-result">🏐 ${scrimMatchLine(f).text} <span class="ps-sets">· ${scrimEsc(s2When(f))}</span></div>`;
  }
  return `<div class="ps-result">📅 <b>${scrimEsc(f.teamA)}</b> <span class="ps-sets">vs</span> <b>${scrimEsc(f.teamB)}</b> <span class="ps-sets">· ${scrimEsc(s2When(f))}</span></div>`;
}


/* ---- homepage score strip (#scoreStrip) ----
   ESPN-style ribbon: recent finals + upcoming fixtures in one
   horizontal scroll. Falls back to the latest scrim results while the
   S2 schedule is empty. */
async function renderScoreStrip() {
  const host = document.getElementById("scoreStrip");
  if (!host) return;
  let data = { fixtures: [] };
  try { data = await apiGet("/s2"); } catch (e) { /* leave empty */ }
  const fx = data.fixtures || [];
  const played = fx.filter(s2Played).sort((a, b) => (b.when || b.createdAt || 0) - (a.when || a.createdAt || 0)).slice(0, 4).reverse();
  const upcoming = fx.filter(f => !s2Played(f)).sort((a, b) => (a.when || Infinity) - (b.when || Infinity)).slice(0, 4);

  const resCard = (m, tag) => {
    let a = 0, b = 0;
    (m.sets || []).forEach(st => {
      const hp = typeof st.a === "number" && typeof st.b === "number";
      (hp ? st.a >= st.b : st.w === "A") ? a++ : b++;
    });
    return `<div class="sc-card">
      <span class="sc-tag">${tag}</span>
      <span class="sc-line${a > b ? " win" : ""}"><span>${scrimEsc(m.teamA)}</span><b>${a}</b></span>
      <span class="sc-line${b > a ? " win" : ""}"><span>${scrimEsc(m.teamB)}</span><b>${b}</b></span>
    </div>`;
  };
  const upCard = f => `<div class="sc-card up">
      <span class="sc-tag">${scrimEsc(s2When(f))}</span>
      <span class="sc-line"><span>${scrimEsc(f.teamA)}</span></span>
      <span class="sc-line"><span>${scrimEsc(f.teamB)}</span></span>
    </div>`;

  let cards = played.map(m => resCard(m, "FINAL")).concat(upcoming.map(upCard));
  if (!cards.length) {
    let scr = { matches: [] };
    try { scr = await apiGet("/scrims"); } catch (e) { /* leave empty */ }
    cards = (scr.matches || []).slice().sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0)).slice(0, 5).reverse()
      .map(m => resCard(m, "PRESEASON"))
      .concat(`<div class="sc-card up"><span class="sc-tag">SEASON 2</span><span class="sc-line"><span>Schedule</span></span><span class="sc-line"><span>coming soon</span></span></div>`);
  }
  if (!cards.length) { host.style.display = "none"; return; }
  host.innerHTML = `<div class="sc-rail">${cards.join("")}<a class="sc-more" href="schedule.html">All fixtures →</a></div>`;
}

/* ---- schedule page (#schedComing / #schedReal / #schedList / #bracketWrap) ---- */
async function renderS2Schedule() {
  const list = document.getElementById("schedList");
  if (!list) return;
  let data = { teams: [], fixtures: [] };
  try { data = await apiGet("/s2"); } catch (e) { /* leave empty */ }
  const fx = data.fixtures || [];
  if (!fx.length) return;                          // keep the "coming soon" card
  const coming = document.getElementById("schedComing");
  if (coming) coming.style.display = "none";
  const real = document.getElementById("schedReal");
  if (real) real.style.display = "";

  const reg = fx.filter(f => f.stage === "regular").slice()
    .sort((a, b) => (a.when || Infinity) - (b.when || Infinity) || (a.createdAt || 0) - (b.createdAt || 0));
  const upcoming = reg.filter(f => !s2Played(f));
  const played = reg.filter(s2Played).reverse();
  list.innerHTML =
    (upcoming.length ? `<h3 class="grp" style="margin:0 0 10px">Upcoming</h3>` + upcoming.map(s2RowHtml).join("") : "") +
    (played.length ? `<h3 class="grp" style="margin:${upcoming.length ? "22px" : "0"} 0 10px">Results</h3>` + played.map(s2RowHtml).join("") : "") +
    (!upcoming.length && !played.length ? `<p class="empty">No regular-season fixtures yet — playoff bracket below.</p>` : "");

  renderS2Bracket(fx);
}

/* ---- playoff bracket (#bracketWrap / #bracketHost) ---- */
function renderS2Bracket(fixtures) {
  const host = document.getElementById("bracketHost");
  if (!host) return;
  const stages = ["qf", "sf", "f", "3rd"];
  const by = {}; stages.forEach(st => { by[st] = (fixtures || []).filter(f => f.stage === st); });
  if (!stages.some(st => by[st].length)) return;   // no playoff fixtures yet
  const wrap = document.getElementById("bracketWrap");
  if (wrap) wrap.style.display = "";

  const matchCard = f => {
    const w = s2Winner(f);
    let a = 0, b = 0;
    if (s2Played(f)) f.sets.forEach(s => {
      const hasPts = typeof s.a === "number" && typeof s.b === "number";
      (hasPts ? s.a >= s.b : s.w === "A") ? a++ : b++;
    });
    const side = (name, sets, isWinner) =>
      `<div class="bk-side${isWinner ? " win" : ""}"><span>${scrimEsc(name)}</span><b>${s2Played(f) ? sets : ""}</b></div>`;
    return `<div class="bk-match">${side(f.teamA, a, w === f.teamA)}${side(f.teamB, b, w === f.teamB)}${s2Played(f) ? "" : `<div class="bk-when">${scrimEsc(s2When(f))}</div>`}</div>`;
  };
  const col = (st, label) => by[st].length
    ? `<div class="bk-col"><div class="bk-stage">${label}</div>${by[st].map(matchCard).join("")}</div>`
    : "";
  const champion = (() => {
    const f = by.f[0];
    const w = f && s2Winner(f);
    return w ? `<div class="bk-col"><div class="bk-stage">Champion</div><div class="bk-match bk-champ">👑 <b>${scrimEsc(w)}</b></div></div>` : "";
  })();
  host.innerHTML = col("qf", "Quarterfinals") + col("sf", "Semifinals") + col("f", "Grand Final") + champion +
    (by["3rd"].length ? `<div class="bk-col"><div class="bk-stage">3rd place</div>${by["3rd"].map(matchCard).join("")}</div>` : "");
}

/* ---- standings page (#s2Coming / #s2Section / #s2Body) ---- */
async function renderS2Standings() {
  const body = document.getElementById("s2Body");
  if (!body) return;
  let data = { teams: [], fixtures: [] };
  try { data = await apiGet("/s2"); } catch (e) { /* leave empty */ }
  const played = (data.fixtures || []).filter(f => f.stage === "regular" && s2Played(f));
  if (!played.length) return;                      // keep the "coming soon" card
  const coming = document.getElementById("s2Coming");
  if (coming) coming.style.display = "none";
  const sec = document.getElementById("s2Section");
  if (sec) sec.style.display = "";

  const rows = computeScrimStandings(data.teams || [], played);
  // Premier-League-style form guide: each team's last 5 results, oldest → newest
  const chrono = played.slice().sort((a, b) => (a.when || a.createdAt || 0) - (b.when || b.createdAt || 0));
  const formBy = {};
  chrono.forEach(m => {
    const w = s2Winner(m);
    [[m.teamA, w === m.teamA], [m.teamB, w === m.teamB]].forEach(([t, won]) => {
      (formBy[t] = formBy[t] || []).push(won);
    });
  });
  const formHtml = t => (formBy[t] || []).slice(-5).map(w => `<span class="fm ${w ? "w" : "l"}">${w ? "W" : "L"}</span>`).join("") || "—";
  const pct = v => v == null ? "—" : Math.round(v * 100) + "%";
  const diff = v => v == null ? "—" : (v > 0 ? "+" + v : "" + v);
  const rec = v => (v > 0 ? "+" + v : "" + v);
  const recCls = v => v > 0 ? "ps-pos" : v < 0 ? "ps-neg" : "ps-zero";
  body.innerHTML = rows.map((t, i) => `
    <tr>
      <td class="rk">${i + 1}</td>
      <td><span class="team"><span class="dot"></span>${scrimEsc(t.name)}</span></td>
      <td class="num">${t.played}</td>
      <td class="num">${t.mw}</td>
      <td class="num">${t.ml}</td>
      <td class="num"><span class="ps-rec ${recCls(t.record)}">${rec(t.record)}</span></td>
      <td class="num">${t.setsPlayed ? `${t.sw}–${t.sl}` : "—"}</td>
      <td class="num">${pct(t.setWinrate)}</td>
      <td class="num">${diff(t.diff)}</td>
      <td class="fm-cell">${formHtml(t.name)}</td>
    </tr>`).join("");
}

document.addEventListener("DOMContentLoaded", function () { renderS2Schedule(); renderS2Standings(); renderScoreStrip(); });
