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
/* Times render in the VISITOR'S timezone — `when` is an absolute epoch,
   so 7pm GMT+8 automatically shows as e.g. 12pm in London. */
function s2When(f) {
  if (!f.when) return "Date TBA";
  const d = new Date(f.when);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
    + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function s2TimeOnly(f) {
  return f.when ? new Date(f.when).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "TBA";
}
/* Which draw group a team is in ("A" / "B" / ""). */
let S2_GROUPS_CACHE = null;
function teamGroup(name) {
  const g = S2_GROUPS_CACHE || {};
  if ((g.A || []).indexOf(name) !== -1) return "A";
  if ((g.B || []).indexOf(name) !== -1) return "B";
  return "";
}
function groupChip(f) {
  const g = teamGroup(f.teamA) || teamGroup(f.teamB);
  return g ? `<span class="grp-chip g${g}">Group ${g}</span>` : "";
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

/* ---- schedule page (#schedComing / #schedReal / #schedList / #bracketWrap) ----
   Big paginated match-night cards: 5 nights per page, played matches shown
   in place with their scores. Opens on the page with the next match night. */
const SCHED_PER_PAGE = 5;
let SCHED_DAYS = [];      // [{ key, when, items }]
let SCHED_PAGE = -1;      // -1 → auto-pick the page with the next unplayed night
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

  S2_GROUPS_CACHE = data.groups || S2_GROUPS_CACHE;
  const reg = fx.filter(f => f.stage === "regular").slice()
    .sort((a, b) => (a.when || Infinity) - (b.when || Infinity) || (a.createdAt || 0) - (b.createdAt || 0));
  // group ALL fixtures chronologically by the visitor's local calendar day
  SCHED_DAYS = [];
  reg.forEach(f => {
    const key = f.when ? new Date(f.when).toDateString() : "TBA";
    const last = SCHED_DAYS[SCHED_DAYS.length - 1];
    if (last && last.key === key) last.items.push(f);
    else SCHED_DAYS.push({ key, when: f.when, items: [f] });
  });
  if (!SCHED_DAYS.length) {
    list.innerHTML = `<p class="empty">No regular-season fixtures yet — playoff bracket below.</p>`;
    renderS2Bracket(fx); return;
  }
  drawSchedPage();
  renderS2Bracket(fx);
}
function drawSchedPage() {
  const list = document.getElementById("schedList");
  const pages = Math.max(1, Math.ceil(SCHED_DAYS.length / SCHED_PER_PAGE));
  if (SCHED_PAGE < 0) {
    // auto: the page holding the first night that still has an unplayed match
    const idx = SCHED_DAYS.findIndex(d => d.items.some(f => !s2Played(f)));
    SCHED_PAGE = Math.floor((idx === -1 ? SCHED_DAYS.length - 1 : idx) / SCHED_PER_PAGE);
  }
  SCHED_PAGE = Math.min(Math.max(SCHED_PAGE, 0), pages - 1);

  const dayHead = d => d.when
    ? new Date(d.when).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    : "Date TBA";
  const setScores = f => (f.sets || []).filter(s => typeof s.a === "number" && typeof s.b === "number").map(s => `${s.a}–${s.b}`).join(", ");
  const row = f => {
    if (!s2Played(f)) {
      return `<div class="sch-row">${groupChip(f)}<span class="sch-teams"><b>${scrimEsc(f.teamA)}</b> <i>vs</i> <b>${scrimEsc(f.teamB)}</b></span><span class="sch-time">🕐 ${scrimEsc(s2TimeOnly(f))} · BO3</span></div>`;
    }
    let a = 0, b = 0;
    f.sets.forEach(s => {
      const hp = typeof s.a === "number" && typeof s.b === "number";
      if (hp) { s.a >= s.b ? a++ : b++; }
      else if (s.w === "A" || s.w === "B") { s.w === "A" ? a++ : b++; }
    });
    const w = s2Winner(f), pts = setScores(f);
    return `<div class="sch-row done">${groupChip(f)}<span class="sch-teams"><b class="${w === f.teamA ? "sch-win" : ""}">${w === f.teamA ? "🏆 " : ""}${scrimEsc(f.teamA)}</b><span class="sch-score">${a}–${b}</span><b class="${w === f.teamB ? "sch-win" : ""}">${scrimEsc(f.teamB)}${w === f.teamB ? " 🏆" : ""}</b></span><span class="sch-time">${pts ? scrimEsc(pts) : "final"}</span></div>`;
  };
  const start = SCHED_PAGE * SCHED_PER_PAGE;
  const slice = SCHED_DAYS.slice(start, start + SCHED_PER_PAGE);
  const dayCard = (d, i) => `
    <div class="sch-day">
      <div class="sch-dayhead"><span class="sch-night">Night ${start + i + 1}</span>${dayHead(d)}${d.items.every(s2Played) ? '<span class="sch-doneflag">🏁 played</span>' : ""}</div>
      ${d.items.map(row).join("")}
    </div>`;
  const pager = pages > 1 ? `
    <div class="sch-pager">
      <button id="schPrev" ${SCHED_PAGE === 0 ? "disabled" : ""}>‹ Earlier</button>
      ${Array.from({ length: pages }, (_, p) => `<button class="sch-pg${p === SCHED_PAGE ? " on" : ""}" data-pg="${p}">${p + 1}</button>`).join("")}
      <button id="schNext" ${SCHED_PAGE === pages - 1 ? "disabled" : ""}>Later ›</button>
    </div>
    <p class="mini-note" style="text-align:center;margin:4px 0 0">Nights ${start + 1}–${start + slice.length} of ${SCHED_DAYS.length} · 5 match nights per page</p>` : "";
  list.innerHTML = slice.map(dayCard).join("") + pager;

  const go = p => { SCHED_PAGE = p; drawSchedPage(); document.getElementById("schedList").scrollIntoView({ behavior: "smooth", block: "start" }); };
  const prev = document.getElementById("schPrev"), next = document.getElementById("schNext");
  if (prev) prev.addEventListener("click", () => go(SCHED_PAGE - 1));
  if (next) next.addEventListener("click", () => go(SCHED_PAGE + 1));
  list.querySelectorAll(".sch-pg").forEach(b => b.addEventListener("click", () => go(+b.dataset.pg)));
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

/* ---- standings page (#s2Coming / #s2Section / #s2Tables) ----
   One table per draw group, Premier-League style, with a form column.
   Shown as soon as the schedule exists (zeros before results post). */
async function renderS2Standings() {
  const host = document.getElementById("s2Tables");
  if (!host) return;
  let data = { teams: [], fixtures: [], groups: null };
  try { data = await apiGet("/s2"); } catch (e) { /* leave empty */ }
  S2_GROUPS_CACHE = data.groups || S2_GROUPS_CACHE;
  const reg = (data.fixtures || []).filter(f => f.stage === "regular");
  if (!reg.length) return;                         // keep the "coming soon" card
  const coming = document.getElementById("s2Coming");
  if (coming) coming.style.display = "none";
  const sec = document.getElementById("s2Section");
  if (sec) sec.style.display = "";

  const played = reg.filter(s2Played);
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

  const groups = S2_GROUPS_CACHE || { A: [], B: [] };
  const tableFor = (gName, gTeams) => {
    const gPlayed = played.filter(f => teamGroup(f.teamA) === gName);
    const rows = computeScrimStandings(gTeams, gPlayed);
    return `
      <h3 class="grp" style="margin:22px 0 10px">Group ${gName} <span style="color:var(--muted);font-weight:600;font-size:13px">· ${gTeams.length} teams · single round robin</span></h3>
      <div class="table-scroll">
        <table class="standings">
          <thead><tr>
            <th>Rank</th><th>Team</th>
            <th class="num" title="Played">P</th>
            <th class="num" title="Wins">W</th>
            <th class="num" title="Losses">L</th>
            <th class="num" title="Points: win +1 / loss −1">Pts</th>
            <th class="num" title="Sets won–lost">Sets</th>
            <th class="num" title="Set win-rate">Set %</th>
            <th class="num" title="Point differential">Diff</th>
            <th title="Last 5 results">Form</th>
          </tr></thead>
          <tbody>${rows.map((t, i) => `
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
            </tr>`).join("")}</tbody>
        </table>
      </div>`;
  };
  host.innerHTML = tableFor("A", groups.A || []) + tableFor("B", groups.B || []);
}

document.addEventListener("DOMContentLoaded", function () { renderS2Schedule(); renderS2Standings(); renderScoreStrip(); });
